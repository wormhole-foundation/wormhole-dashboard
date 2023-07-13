package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	tm "github.com/buger/goterm"
	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"github.com/eiannone/keyboard"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/libp2p/go-libp2p/core/crypto"
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

type heartbeat struct {
	bootTimestamp time.Time
	counter       string
	features      []string
	guardianAddr  string
	networks      []*gossipv1.Heartbeat_Network
	nodeName      string
	timestamp     time.Time
	version       string
}

func main() {
	// TODO: pass in config instead of hard-coding it
	p2pNetworkID = "/wormhole/mainnet/2"
	p2pBootstrap = "/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7,/dns4/wormhole-v2-mainnet-bootstrap.xlabs.xyz/udp/8999/quic/p2p/12D3KooWNQ9tVrcb64tw6bNs2CaNrUGPM7yRrKvBBheQ5yCyPHKC"
	p2pPort = 8999
	nodeKeyPath = "/tmp/node.key"
	logLevel = "warn"

	rpcUrl := flag.String("rpcUrl", "https://rpc.ankr.com/eth", "RPC URL for fetching current guardian set")
	coreBridgeAddr := flag.String("coreBridgeAddr", "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B", "Core bridge address for fetching guardian set")
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
	obsvC := make(chan *gossipv1.SignedObservation, 1024)

	// Inbound observation requests
	obsvReqC := make(chan *gossipv1.ObservationRequest, 1024)

	// Inbound signed VAAs
	signedInC := make(chan *gossipv1.SignedVAAWithQuorum, 1024)

	// Heartbeat updates
	heartbeatC := make(chan *gossipv1.Heartbeat, 1024)

	// Guardian set state managed by processor
	gst := common.NewGuardianSetState(heartbeatC)

	// Governor cfg
	govConfigC := make(chan *gossipv1.SignedChainGovernorConfig, 1024)

	// Governor status
	govStatusC := make(chan *gossipv1.SignedChainGovernorStatus, 1024)
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

	hbByGuardian := make(map[string]heartbeat, len(gs.Keys))

	activeTable := 1 // 0 = chains, 1 = guardians

	resetTerm(true)

	chainTable := table.NewWriter()
	chainTable.SetOutputMirror(os.Stdout)
	chainTable.AppendHeader(table.Row{"ID", "Chain", "Status", "Healthy", "Highest"})
	chainTable.SetStyle(table.StyleColoredDark)
	chainTable.SortBy([]table.SortBy{
		{Name: "ID", Mode: table.AscNumeric},
	})

	guardianTable := table.NewWriter()
	guardianTable.SetOutputMirror(os.Stdout)
	guardianTable.AppendHeader(table.Row{"#", "Guardian", "Version", "Features", "Counter", "Boot", "Timestamp", "Address"})
	for idx, g := range gs.Keys {
		guardianTable.AppendRow(table.Row{idx, "", "", "", "", "", "", g})
	}
	guardianTable.SetStyle(table.StyleColoredDark)
	guardianTable.Render()
	prompt()

	// Keyboard handler
	if err := keyboard.Open(); err != nil {
		panic(err)
	}
	defer func() {
		keyboard.Close()
		resetTerm(true)
	}()
	go func() {
		for {
			char, key, err := keyboard.GetKey()
			if err != nil {
				logger.Fatal("error getting key", zap.Error(err))
			}
			wantsOut := false
			if key == keyboard.KeyCtrlC {
				wantsOut = true
			} else {
				switch string(char) {
				case "q":
					wantsOut = true
				case "c":
					activeTable = 0
					resetTerm(true)
					chainTable.Render()
					prompt()
				case "g":
					activeTable = 1
					resetTerm(true)
					guardianTable.Render()
					prompt()
				}
			}
			if wantsOut {
				break
			}
		}
		rootCtxCancel()
	}()

	// Ignore observations
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-obsvC:
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
				id := hb.GuardianAddr
				hbByGuardian[id] = heartbeat{
					bootTimestamp: time.Unix(hb.BootTimestamp/1000000000, 0),
					counter:       strconv.FormatInt(hb.Counter, 10),
					features:      hb.Features,
					guardianAddr:  hb.GuardianAddr,
					networks:      hb.Networks,
					nodeName:      hb.NodeName,
					timestamp:     time.Unix(hb.Timestamp/1000000000, 0),
					version:       hb.Version,
				}
				chainTable.ResetRows()
				guardianTable.ResetRows()
				chainIdsToHeartbeats := make(map[uint32][]*gossipv1.Heartbeat_Network)
				for idx, g := range gs.Keys {
					info, ok := hbByGuardian[g.String()]
					if ok {
						guardianTable.AppendRow(table.Row{idx, info.nodeName, info.version, strings.Join(info.features, ", "), info.counter, info.bootTimestamp, info.timestamp, g})
						for _, network := range info.networks {
							if _, ok := chainIdsToHeartbeats[network.Id]; !ok {
								chainIdsToHeartbeats[network.Id] = make([]*gossipv1.Heartbeat_Network, len(gs.Keys))
							}
							chainIdsToHeartbeats[network.Id] = append(chainIdsToHeartbeats[network.Id], network)
						}
					} else {
						guardianTable.AppendRow(table.Row{idx, "", "", "", "", "", "", g})
					}
				}
				for chainId, heartbeats := range chainIdsToHeartbeats {
					highest := int64(0)
					for _, heartbeat := range heartbeats {
						if heartbeat != nil && heartbeat.Height > highest {
							highest = heartbeat.Height
						}
					}
					healthyCount := 0
					for _, heartbeat := range heartbeats {
						if heartbeat != nil && heartbeat.Height != 0 && highest-heartbeat.Height <= 1000 {
							healthyCount++
						}
					}
					status := "green"
					if healthyCount < vaa.CalculateQuorum(len(gs.Keys)) {
						status = "red"
					} else if healthyCount < len(gs.Keys)-1 {
						status = "yellow"
					}
					chainTable.AppendRow(table.Row{chainId, vaa.ChainID(chainId), status, healthyCount, highest})
				}
				if activeTable == 0 {
					resetTerm(false)
					chainTable.Render()
				} else {
					resetTerm(false)
					guardianTable.Render()
				}
				prompt()
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
	supervisor.New(rootCtx, logger, func(ctx context.Context) error {
		if err := supervisor.Run(ctx, "p2p", p2p.Run(obsvC, obsvReqC, nil, sendC, signedInC, priv, nil, gst, p2pNetworkID, p2pBootstrap, "", false, rootCtxCancel, nil, nil, govConfigC, govStatusC, nil, nil)); err != nil {
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
}

func resetTerm(clear bool) {
	if clear {
		tm.Clear()
	}
	tm.MoveCursor(1, 1)
	tm.Flush()
}

func prompt() {
	fmt.Print("[C]hains, [G]uardians, [Q]uit: ")
}
