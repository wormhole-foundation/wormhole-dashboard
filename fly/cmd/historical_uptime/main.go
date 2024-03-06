package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
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
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/db"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/historical_uptime"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"
	"github.com/wormhole-foundation/wormhole/sdk/vaa"
	"go.uber.org/zap"
)

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc

	dataDir        string
	p2pNetworkID   string
	p2pPort        uint
	p2pBootstrap   string
	nodeKeyPath    string
	logLevel       string
	ethRpcUrl      string
	coreBridgeAddr string
	promRemoteURL  string
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

var (
	// guardianChainHeights indexes current chain height by chain id and guardian name
	guardianChainHeights = make(common.GuardianChainHeights)
)

func loadEnvVars() {
	err := godotenv.Load() // By default loads .env
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	dataDir = verifyEnvVar("DATA_DIR")
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

func initObservationScraper(db *db.Database, logger *zap.Logger, errC chan error) {
	node_common.StartRunnable(rootCtx, errC, false, "observation_scraper", func(ctx context.Context) error {
		t := time.NewTicker(15 * time.Second)

		for {
			select {
			case <-ctx.Done():
				return nil
			case <-t.C:
				messages, err := db.QueryMessagesByIndex(false, common.ExpiryDuration)
				if err != nil {
					logger.Error("QueryMessagesByIndex error", zap.Error(err))
					continue
				}

				// Tally the number of messages for each chain
				messagesPerChain := historical_uptime.TallyMessagesPerChain(logger, messages)

				// Initialize the missing observations count for each guardian for each chain
				guardianMissingObservations := historical_uptime.InitializeMissingObservationsCount(logger, messages, messagesPerChain)

				// Decrement the missing observations count for each observed message
				historical_uptime.DecrementMissingObservationsCount(logger, guardianMissingObservations, messages)

				// Update the metrics with the final count of missing observations
				historical_uptime.UpdateMetrics(guardianMissedObservations, guardianMissingObservations)
			}
		}
	})
}

func initDatabaseCleanUp(db *db.Database, logger *zap.Logger, errC chan error) {
	node_common.StartRunnable(rootCtx, errC, false, "db_cleanup", func(ctx context.Context) error {
		t := time.NewTicker(common.DatabaseCleanUpInterval)

		for {
			select {
			case <-ctx.Done():
				return nil
			case <-t.C:
				err := db.RemoveMessagesByIndex(true, common.ExpiryDuration)
				if err != nil {
					logger.Error("RemoveObservationsByIndex error", zap.Error(err))
				}
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

	// Outbound gossip message queue
	sendC := make(chan []byte)

	// Inbound observations
	obsvC := make(chan *node_common.MsgWithTimeStamp[gossipv1.SignedObservation], 1024)

	// Inbound observation requests
	obsvReqC := make(chan *gossipv1.ObservationRequest, 50)

	// Inbound signed VAAs
	signedInC := make(chan *gossipv1.SignedVAAWithQuorum, 50)

	// Heartbeat updates
	heartbeatC := make(chan *gossipv1.Heartbeat, 50)

	// Guardian set state managed by processor
	gst := node_common.NewGuardianSetState(heartbeatC)

	// Governor cfg
	govConfigC := make(chan *gossipv1.SignedChainGovernorConfig, 50)

	// Governor status
	govStatusC := make(chan *gossipv1.SignedChainGovernorStatus, 50)
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

	db := db.OpenDb(logger, &dataDir)
	promErrC := make(chan error)
	// Start Prometheus scraper
	initPromScraper(promRemoteURL, logger, promErrC)
	initObservationScraper(db, logger, promErrC)
	initDatabaseCleanUp(db, logger, promErrC)

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

	// WIP(bing): add metrics for guardian observations
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case o := <-obsvC:
				historical_uptime.ProcessObservation(*db, logger, *o)
			}
		}
	}()

	// Ignore observation requests
	// Note: without this, the whole program hangs on observation requests
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-obsvReqC:
			}
		}
	}()

	// Ignore signed VAAs
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-signedInC:
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

	// Handle govConfigs
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-govConfigC:
			}
		}
	}()

	// Handle govStatus
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-govStatusC:
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
	supervisor.New(rootCtx, logger, func(ctx context.Context) error {
		if err := supervisor.Run(ctx,
			"p2p",
			p2p.Run(obsvC,
				obsvReqC,
				nil,
				sendC,
				signedInC,
				priv,
				nil,
				gst,
				p2pNetworkID,
				p2pBootstrap,
				"",
				false,
				rootCtxCancel,
				nil,
				nil,
				govConfigC,
				govStatusC,
				components,
				nil,
				false,
				false,
				nil,
				nil,
				"",
				0,
				"",
			)); err != nil {
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
	logger.Info("root context cancelled, exiting...")
	// TODO: wait for things to shut down gracefully

}
