package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	node_common "github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	promremotew "github.com/certusone/wormhole/node/pkg/telemetry/prom_remote_write"
	eth_common "github.com/ethereum/go-ethereum/common"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"
	"github.com/wormhole-foundation/wormhole/sdk/vaa"
	"go.uber.org/zap"
)

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc
)

var (
	p2pNetworkID string
	p2pPort      uint
	p2pBootstrap string
	nodeKeyPath  string
	logLevel     string
)

var guardianObservations = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "guardian_observations_total",
		Help: "Total number of observations received from each guardian on each chain",
	},
	[]string{"guardian", "chain"},
)

var guardianChainHeight = prometheus.NewGaugeVec(
	prometheus.GaugeOpts{
		Name: "guardian_chain_height",
		Help: "Current height of each guardian on each chain over time",
	},
	[]string{"guardian", "chain"},
)

func init() {
	// Register the Prometheus counter vector.
	prometheus.MustRegister(guardianObservations)
	prometheus.MustRegister(guardianChainHeight)
}

func initPromScraper(promRemoteURL *string, logger *zap.Logger) {
	usingPromRemoteWrite := *promRemoteURL != ""
	if usingPromRemoteWrite {
		var info promremotew.PromTelemetryInfo
		info.PromRemoteURL = *promRemoteURL
		info.Labels = map[string]string{
			"product": "wormhole-fly",
		}

		promLogger := logger.With(zap.String("component", "prometheus_scraper"))
		errC := make(chan error)
		node_common.StartRunnable(rootCtx, errC, false, "prometheus_scraper", func(ctx context.Context) error {
			t := time.NewTicker(15 * time.Second)

			for {
				select {
				case <-ctx.Done():
					return nil
				case <-t.C:
					for i := 1; i < 36; i++ {
						if i == 26 {
							continue
						}
						chainName := vaa.ChainID(i).String()
						if strings.HasPrefix(chainName, "unknown chain ID:") {
							continue
						}
						// when there are no observations in any guardian for a particular chain for a period of time,
						// the chain label will not be present in the metrics.
						// adding this will make sure chain labels are present regardless
						guardianObservations.WithLabelValues("N/A", chainName).Add(0)
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

func main() {
	// TODO: pass in config instead of hard-coding it
	p2pNetworkID = "/wormhole/mainnet/2"
	p2pBootstrap = "/dns4/wormhole-v2-mainnet-bootstrap.xlabs.xyz/udp/8999/quic/p2p/12D3KooWNQ9tVrcb64tw6bNs2CaNrUGPM7yRrKvBBheQ5yCyPHKC,/dns4/wormhole.mcf.rocks/udp/8999/quic/p2p/12D3KooWDZVv7BhZ8yFLkarNdaSWaB43D6UbQwExJ8nnGAEmfHcU,/dns4/wormhole-v2-mainnet-bootstrap.staking.fund/udp/8999/quic/p2p/12D3KooWG8obDX9DNi1KUwZNu9xkGwfKqTp2GFwuuHpWZ3nQruS1"
	p2pPort = 8999
	nodeKeyPath = "/tmp/node.key"
	logLevel = "info"
	rpcUrl := flag.String("rpcUrl", "https://rpc.ankr.com/eth", "RPC URL for fetching current guardian set")
	coreBridgeAddr := flag.String("coreBridgeAddr", "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B", "Core bridge address for fetching guardian set")
	promRemoteWriteUrl := flag.String("promRemoteWriteUrl", "http://localhost:9090/api/v1/write", "Prometheus remote write URL")
	flag.Parse()
	if *rpcUrl == "" {
		fmt.Println("rpcUrl must be specified")
		os.Exit(1)
	}
	if *coreBridgeAddr == "" {
		fmt.Println("coreBridgeAddr must be specified")
		os.Exit(1)
	}
	lvl, err := ipfslog.LevelFromString(logLevel)
	if err != nil {
		fmt.Println("Invalid log level")
		os.Exit(1)
	}

	logger := ipfslog.Logger("wormhole-fly").Desugar()

	ipfslog.SetAllLoggers(lvl)

	// ctx := context.Background()

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
	idx, sgs, err := utils.FetchCurrentGuardianSet(*rpcUrl, *coreBridgeAddr)
	if err != nil {
		logger.Fatal("Failed to fetch guardian set", zap.Error(err))
	}
	logger.Info("guardian set", zap.Uint32("index", idx), zap.Any("gs", sgs))
	gs := node_common.GuardianSet{
		Keys:  sgs.Keys,
		Index: idx,
	}
	gst.Set(&gs)

	// Start Prometheus scraper
	initPromScraper(promRemoteWriteUrl, logger)

	// WIP(bing): add metrics for guardian observations
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case o := <-obsvC:
				// Ignore observations from pythnnet
				// Pythnet sends too many observations that could deteriorate the performance of the fly node
				if o.Msg.MessageId[:3] != "26/" {
					ga := eth_common.BytesToAddress(o.Msg.Addr).String()
					chainID := strings.Split(o.Msg.MessageId, "/")[0]
					ui64, err := strconv.ParseUint(chainID, 10, 16)
					if err != nil {
						panic(err)
					}
					chainName := vaa.ChainID(ui64).String()
					guardianName, ok := common.GetGuardianName(ga)
					if !ok {
						logger.Error("guardian name not found", zap.String("guardian", ga))
					}
					guardianObservations.WithLabelValues(guardianName, chainName).Inc()
				}
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
				for _, network := range hb.Networks {
					guardianName, ok := common.GetGuardianName(hb.GuardianAddr)
					if !ok {
						logger.Error("guardian name not found", zap.String("guardian", hb.GuardianAddr))
					}

					guardianChainHeight.With(
						prometheus.Labels{
							"guardian": guardianName,
							"chain":    vaa.ChainID(network.Id).String(),
						},
					).Set(float64(network.Height))
				}
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
