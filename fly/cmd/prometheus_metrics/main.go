package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	promremotew "github.com/certusone/wormhole/node/pkg/telemetry/prom_remote_write"
	eth_common "github.com/ethereum/go-ethereum/common"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/prometheus/client_golang/prometheus"
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

// Guardian address to index map
var guardianIndexMap = map[string]int{
	strings.ToLower("0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5"): 0,
	strings.ToLower("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157"): 1,
	strings.ToLower("0x114De8460193bdf3A2fCf81f86a09765F4762fD1"): 2,
	strings.ToLower("0x107A0086b32d7A0977926A205131d8731D39cbEB"): 3,
	strings.ToLower("0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2"): 4,
	strings.ToLower("0x11b39756C042441BE6D8650b69b54EbE715E2343"): 5,
	strings.ToLower("0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd"): 6,
	strings.ToLower("0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20"): 7,
	strings.ToLower("0x74a3bf913953D695260D88BC1aA25A4eeE363ef0"): 8,
	strings.ToLower("0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e"): 9,
	strings.ToLower("0xAF45Ced136b9D9e24903464AE889F5C8a723FC14"): 10,
	strings.ToLower("0xf93124b7c738843CBB89E864c862c38cddCccF95"): 11,
	strings.ToLower("0xD2CC37A4dc036a8D232b48f62cDD4731412f4890"): 12,
	strings.ToLower("0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811"): 13,
	strings.ToLower("0x71AA1BE1D36CaFE3867910F99C09e347899C19C3"): 14,
	strings.ToLower("0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf"): 15,
	strings.ToLower("0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8"): 16,
	strings.ToLower("0x5E1487F35515d02A92753504a8D75471b9f49EdB"): 17,
	strings.ToLower("0x6FbEBc898F403E4773E95feB15E80C9A99c8348d"): 18,
}

var guardianIndexToNameMap = map[int]string{
	0:  "Jump Crypto",
	1:  "Staked",
	2:  "Figment",
	3:  "ChainodeTech",
	4:  "Inotel",
	5:  "HashQuark",
	6:  "ChainLayer",
	7:  "xLabs",
	8:  "Forbole",
	9:  "Staking Fund",
	10: "MoonletWallet",
	11: "P2P Validator",
	12: "01node",
	13: "MCF-V2-MAINNET",
	14: "Everstake",
	15: "Chorus One",
	16: "syncnode",
	17: "Triton",
	18: "Staking Facilities",
	19: "Totals:",
}

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
		common.StartRunnable(rootCtx, errC, false, "prometheus_scraper", func(ctx context.Context) error {
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
					logger.Debug("ScrapeAndSendLocalMetrics success at %s", zap.Time("time", time.Now()))
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
	obsvC := make(chan *common.MsgWithTimeStamp[gossipv1.SignedObservation], 1024)

	// Inbound observation requests
	obsvReqC := make(chan *gossipv1.ObservationRequest, 50)

	// Inbound signed VAAs
	signedInC := make(chan *gossipv1.SignedVAAWithQuorum, 50)

	// Heartbeat updates
	heartbeatC := make(chan *gossipv1.Heartbeat, 50)

	// Guardian set state managed by processor
	gst := common.NewGuardianSetState(heartbeatC)

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
	gs := common.GuardianSet{
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
					guardianName, ok := guardianIndexToNameMap[guardianIndexMap[strings.ToLower(ga)]]
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
					guardianChainHeight.With(
						prometheus.Labels{
							"guardian": guardianIndexToNameMap[guardianIndexMap[strings.ToLower(hb.GuardianAddr)]],
							"chain":            vaa.ChainID(network.Id).String(),
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
	priv, err = common.GetOrCreateNodeKey(logger, nodeKeyPath)
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
