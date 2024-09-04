package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	node_common "github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	promremotew "github.com/certusone/wormhole/node/pkg/telemetry/prom_remote_write"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/joho/godotenv"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/bigtable"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/historical_uptime"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"
	"github.com/wormhole-foundation/wormhole/sdk/vaa"
	"go.uber.org/zap"
)

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc

	p2pNetworkID   string
	p2pPort        uint
	p2pBootstrap   string
	nodeKeyPath    string
	logLevel       string
	ethRpcUrl      string
	coreBridgeAddr string
	promRemoteURL  string

	gcpProjectId         string
	useBigtableEmulator  bool        // only use this in local development
	bigTableEmulatorHost string = "" // required if using emulator
	gcpCredentialsFile   string = "" // required if not using emulator
	bigTableInstanceId   string
)

var (
	guardianObservations = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "guardian_observations_total",
			Help: "Total number of observations received from each guardian on each chain",
		},
		[]string{"guardian", "chain"},
	)

	guardianChainHeight = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "guardian_chain_height",
			Help: "Current height of each guardian on each chain over time",
		},
		[]string{"guardian", "chain"},
	)

	guardianChainHeightDifferences = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "guardian_chain_height_differences",
			Help: "Current height difference of each guardian from max height on each chain over time",
		},
		[]string{"guardian", "chain"},
	)

	guardianHeartbeats = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "guardian_heartbeats",
			Help: "Heartbeat count of each guardian on each chain over time",
		},
		[]string{"guardian"},
	)

	guardianMissedObservations = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "guardian_missed_observations_total",
			Help: "Total number of observations missed by each guardian on each chain",
		},
		[]string{"guardian", "chain"},
	)
)

const PYTHNET_CHAIN_ID = int(vaa.ChainIDPythNet)

// guardianChainHeights indexes current chain height by chain id and guardian name
var guardianChainHeights = make(common.GuardianChainHeights)

func loadEnvVars() {
	err := godotenv.Load() // By default loads .env
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	p2pNetworkID = verifyEnvVar("P2P_NETWORK_ID")
	port, err := strconv.ParseUint(verifyEnvVar("P2P_PORT"), 10, 32)
	if err != nil {
		log.Fatal("Error parsing P2P_PORT")
	}
	p2pPort = uint(port)
	nodeKeyPath = verifyEnvVar("NODE_KEY_PATH")
	logLevel = verifyEnvVar("LOG_LEVEL")
	ethRpcUrl = verifyEnvVar("ETH_RPC_URL")
	coreBridgeAddr = verifyEnvVar("CORE_BRIDGE_ADDR")
	promRemoteURL = verifyEnvVar("PROM_REMOTE_URL")

	gcpProjectId = verifyEnvVar("GCP_PROJECT_ID")
	bigTableInstanceId = verifyEnvVar("BIGTABLE_INSTANCE_ID")
	useBigtableEmulator, err = strconv.ParseBool(verifyEnvVar("USE_BIGTABLE_EMULATOR"))
	if err != nil {
		log.Fatal("Error parsing USE_BIGTABLE_EMULATOR")
	}
	if useBigtableEmulator {
		bigTableEmulatorHost = verifyEnvVar("BIGTABLE_EMULATOR_HOST")
	} else {
		gcpCredentialsFile = verifyEnvVar("GCP_CREDENTIALS_FILE")
	}
}

func verifyEnvVar(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("%s must be specified", key)
	}
	return value
}

func recordGuardianHeightDifferences() {
	guardianHeightDifferencesByChain := historical_uptime.GetGuardianHeightDifferencesByChain(guardianChainHeights)

	for chainId, guardianHeightDifferences := range guardianHeightDifferencesByChain {
		chainName := vaa.ChainID(chainId).String()

		for guardian, heightDifference := range guardianHeightDifferences {
			guardianChainHeightDifferences.WithLabelValues(guardian, chainName).Set(float64(heightDifference))
		}
	}
}

func initPromScraper(promRemoteURL string, logger *zap.Logger, errC chan error) {
	usingPromRemoteWrite := promRemoteURL != ""
	if usingPromRemoteWrite {
		var info promremotew.PromTelemetryInfo
		info.PromRemoteURL = promRemoteURL
		info.Labels = map[string]string{
			"network": p2pNetworkID,
			"product": "historical_uptime",
		}

		promLogger := logger.With(zap.String("component", "prometheus_scraper"))

		node_common.StartRunnable(rootCtx, errC, false, "prometheus_scraper", func(ctx context.Context) error {
			t := time.NewTicker(15 * time.Second)

			for {
				select {
				case <-ctx.Done():
					return nil
				case <-t.C:
					recordGuardianHeightDifferences()
					for i := 1; i < 36; i++ {
						if i == PYTHNET_CHAIN_ID {
							continue
						}
						chainName := vaa.ChainID(i).String()
						if strings.HasPrefix(chainName, "unknown chain ID:") {
							continue
						}

						// when there are no observations in any guardian for a particular chain for a period of time,
						// the chain label will not be present in the metrics.
						// adding this will make sure chain labels are present regardless
						for _, guardianName := range common.GetGuardianIndexToNameMap() {
							guardianObservations.WithLabelValues(guardianName, chainName).Add(0)
							guardianMissedObservations.WithLabelValues(guardianName, chainName).Add(0)
						}
					}
					err := promremotew.ScrapeAndSendLocalMetrics(ctx, info, promLogger)
					if err != nil {
						promLogger.Error("ScrapeAndSendLocalMetrics error", zap.Error(err))
						continue
					}
				}
			}
		})
	}
}

func initObservationScraper(db *bigtable.BigtableDB, logger *zap.Logger, errC chan error) {
	node_common.StartRunnable(rootCtx, errC, false, "observation_scraper", func(ctx context.Context) error {
		t := time.NewTicker(15 * time.Second)

		for {
			select {
			case <-ctx.Done():
				return nil
			case <-t.C:
				messageObservations := make(map[types.MessageID][]*types.Observation)

				messages, err := db.GetUnprocessedMessagesBeforeCutOffTime(ctx, time.Now().Add(-common.ExpiryDuration))
				if err != nil {
					logger.Error("QueryMessagesByIndex error", zap.Error(err))
					continue
				}

				for _, message := range messages {
					observations, err := db.GetObservationsByMessageID(ctx, string(message.MessageID))
					if err != nil {
						logger.Error("GetObservationsByMessageID error",
							zap.Error(err),
							zap.String("messageId", string(message.MessageID)),
						)
						continue
					}

					messageObservations[message.MessageID] = observations
				}

				// Tally the number of messages for each chain
				messagesPerChain := historical_uptime.TallyMessagesPerChain(logger, messages)

				// Initialize the missing observations count for each guardian for each chain
				guardianMissingObservations := historical_uptime.InitializeMissingObservationsCount(logger, messages, messagesPerChain)

				// Decrement the missing observations count for each observed message
				historical_uptime.DecrementMissingObservationsCount(logger, guardianMissingObservations, messageObservations)

				// Update the metrics with the final count of missing observations
				historical_uptime.UpdateMetrics(logger, guardianMissedObservations, guardianMissingObservations)
			}
		}
	})
}

func main() {
	loadEnvVars()
	p2pBootstrap = "/dns4/wormhole-v2-mainnet-bootstrap.xlabs.xyz/udp/8999/quic/p2p/12D3KooWNQ9tVrcb64tw6bNs2CaNrUGPM7yRrKvBBheQ5yCyPHKC,/dns4/wormhole.mcf.rocks/udp/8999/quic/p2p/12D3KooWDZVv7BhZ8yFLkarNdaSWaB43D6UbQwExJ8nnGAEmfHcU,/dns4/wormhole-v2-mainnet-bootstrap.staking.fund/udp/8999/quic/p2p/12D3KooWG8obDX9DNi1KUwZNu9xkGwfKqTp2GFwuuHpWZ3nQruS1"

	lvl, err := ipfslog.LevelFromString(logLevel)
	if err != nil {
		fmt.Println("Invalid log level")
		os.Exit(1)
	}

	logger := ipfslog.Logger("historical-uptime").Desugar()

	ipfslog.SetAllLoggers(lvl)

	// Node's main lifecycle context.
	rootCtx, rootCtxCancel = context.WithCancel(context.Background())
	defer rootCtxCancel()

	// Inbound observations
	obsvC := make(chan *node_common.MsgWithTimeStamp[gossipv1.SignedObservation], 1024)
	batchObsvC := make(chan *node_common.MsgWithTimeStamp[gossipv1.SignedObservationBatch], 1024)

	// Add channel capacity checks
	go monitorChannelCapacity(rootCtx, logger, "obsvC", obsvC)
	go monitorChannelCapacity(rootCtx, logger, "batchObsvC", batchObsvC)

	// Heartbeat updates
	heartbeatC := make(chan *gossipv1.Heartbeat, 50)

	// Guardian set state managed by processor
	gst := node_common.NewGuardianSetState(heartbeatC)

	// Bootstrap guardian set, otherwise heartbeats would be skipped
	idx, sgs, err := utils.FetchCurrentGuardianSet(ethRpcUrl, coreBridgeAddr)
	if err != nil {
		logger.Fatal("Failed to fetch guardian set", zap.Error(err))
	}

	gs := node_common.GuardianSet{
		Keys:  sgs.Keys,
		Index: idx,
	}
	gst.Set(&gs)

	db, err := bigtable.NewBigtableDB(rootCtx, gcpProjectId, bigTableInstanceId, gcpCredentialsFile, bigTableEmulatorHost, useBigtableEmulator)
	if err != nil {
		logger.Fatal("Failed to create bigtable db", zap.Error(err))
	}

	promErrC := make(chan error)
	// Start Prometheus scraper
	initPromScraper(promRemoteURL, logger, promErrC)
	initObservationScraper(db, logger, promErrC)

	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case err := <-promErrC:
				logger.Error("error from prometheus scraper", zap.Error(err))
			}
		}
	}()

	batchSize := 100
	observationBatch := make([]*types.Observation, 0, batchSize)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// to make sure that we wait til observation cleanup is done
	var wg sync.WaitGroup

	// rootCtx might not cancel if shutdown abruptly
	go func() {
		<-sigChan
		logger.Info("Received signal, initiating shutdown")
		rootCtxCancel()
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-rootCtx.Done():
				if len(observationBatch) > 0 {
					historical_uptime.ProcessObservationBatch(*db, logger, observationBatch)
				}
				logger.Info("Observation cleanup completed.")
				return
			case o := <-obsvC: // TODO: Rip out this code once we cut over to batching.
				obs := historical_uptime.CreateNewObservation(o.Msg.MessageId, o.Msg.Addr, o.Timestamp, o.Msg.Addr)
				observationBatch = append(observationBatch, obs)

				// if it reaches batchSize then process this batch
				if len(observationBatch) >= batchSize {
					historical_uptime.ProcessObservationBatch(*db, logger, observationBatch)
					observationBatch = observationBatch[:0] // Clear the batch
				}
			case batch := <-batchObsvC:
				for _, signedObs := range batch.Msg.Observations {
					obs := historical_uptime.CreateNewObservation(signedObs.MessageId, signedObs.Signature, batch.Timestamp, signedObs.TxHash)
					observationBatch = append(observationBatch, obs)

					// if it reaches batchSize then process this batch
					if len(observationBatch) >= batchSize {
						historical_uptime.ProcessObservationBatch(*db, logger, observationBatch)
						observationBatch = observationBatch[:0] // Clear the batch
					}
				}

			case <-ticker.C:
				// for every interval, process the batch
				if len(observationBatch) > 0 {
					historical_uptime.ProcessObservationBatch(*db, logger, observationBatch)
					observationBatch = observationBatch[:0] // Clear the batch
				}
			}
		}
	}()

	// Handle heartbeats
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case hb := <-heartbeatC:
				guardianName, ok := common.GetGuardianName(hb.GuardianAddr)
				if !ok {
					logger.Error("guardian name not found", zap.String("guardian", hb.GuardianAddr))
					continue // Skip setting the metric if guardianName is not found
				}

				for _, network := range hb.Networks {
					if guardianChainHeights[network.Id] == nil {
						guardianChainHeights[network.Id] = make(common.GuardianHeight)
					}

					guardianChainHeights[network.Id][guardianName] = uint64(network.Height)
					guardianChainHeight.With(
						prometheus.Labels{
							"guardian": guardianName,
							"chain":    vaa.ChainID(network.Id).String(),
						},
					).Set(float64(network.Height))
				}

				guardianHeartbeats.With(
					prometheus.Labels{
						"guardian": guardianName,
					},
				).Set(float64(hb.Counter))

			}
		}
	}()

	// Load p2p private key
	var priv crypto.PrivKey
	priv, err = node_common.GetOrCreateNodeKey(logger, nodeKeyPath)
	if err != nil {
		logger.Fatal("Failed to load node key", zap.Error(err))
	}

	// Run supervisor.
	components := p2p.DefaultComponents()
	components.Port = p2pPort

	params, err := p2p.NewRunParams(
		p2pBootstrap,
		p2pNetworkID,
		priv,
		gst,
		rootCtxCancel,
		p2p.WithComponents(components),
		p2p.WithSignedObservationListener(obsvC),
		p2p.WithSignedObservationBatchListener(batchObsvC),
	)
	if err != nil {
		logger.Fatal("Failed to create RunParams", zap.Error(err))
	}

	supervisor.New(rootCtx, logger, func(ctx context.Context) error {
		if err := supervisor.Run(ctx,
			"p2p",
			p2p.Run(params)); err != nil {
			return err
		}

		logger.Info("Started internal services")

		<-ctx.Done()
		return nil
	},
		// It's safer to crash and restart the process in case we encounter a panic,
		// rather than attempting to reschedule the runnable.
		supervisor.WithPropagatePanic)

	<-rootCtx.Done()
	logger.Info("Root context cancelled, starting cleanup...")

	// Wait for all goroutines to complete their cleanup
	wg.Wait()

	logger.Info("All cleanup completed. Exiting...")
}

func monitorChannelCapacity[T any](ctx context.Context, logger *zap.Logger, channelName string, ch <-chan T) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			capacity := cap(ch)
			length := len(ch)
			utilization := float64(length) / float64(capacity) * 100

			logger.Info("Channel capacity check",
				zap.String("channel", channelName),
				zap.Int("capacity", capacity),
				zap.Int("length", length),
				zap.Float64("utilization_percentage", utilization))

			if utilization > 80 {
				logger.Warn("Channel near capacity, potential for dropped messages",
					zap.String("channel", channelName),
					zap.Float64("utilization_percentage", utilization))
			}
		}
	}
}
