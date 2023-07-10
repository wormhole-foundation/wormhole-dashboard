package main

import (
	"context"
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
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"

	"go.uber.org/zap"
)

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc
)

var (
	p2pNetworkID       string
	p2pPort            uint
	p2pBootstrap       string
	nodeKeyPath        string
	logLevel           string
)

type heartbeat struct {
	bootTimestamp time.Time
	counter       string
	features      []string
	guardianAddr  string
	networks      []*map[string]interface{}
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
	idx, sgs, err := utils.FetchCurrentGuardianSet()
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

	tm.Clear()
	tm.MoveCursor(1,1)
	tm.Flush()
	t := table.NewWriter()
	t.SetOutputMirror(os.Stdout)
    t.AppendHeader(table.Row{"#", "Name", "Version", "Features", "Counter", "Boot", "Timestamp", "Address"})
	for idx, g := range gs.Keys {
		t.AppendRow(table.Row{idx, "", "", "", "", "", "", g})
	}
	t.SetStyle(table.StyleColoredDark)
	t.Render()

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
				networks := make([]*map[string]interface{}, 0, len(hb.Networks))
				for _, network := range hb.Networks {
					networks = append(networks, &map[string]interface{}{
						"id":              network.Id,
						"height":          strconv.FormatInt(network.Height, 10),
						"contractAddress": network.ContractAddress,
						"errorCount":      strconv.FormatUint(network.ErrorCount, 10),
					})
				}
				hbByGuardian[id] = heartbeat{
					bootTimestamp: time.Unix(hb.BootTimestamp / 1000000000, 0),
					counter:       strconv.FormatInt(hb.Counter, 10),
					features:      hb.Features,
					guardianAddr:  hb.GuardianAddr,
					networks:      networks,
					nodeName:      hb.NodeName,
					timestamp:     time.Unix(hb.Timestamp / 1000000000, 0),
					version:       hb.Version,
				}
				tm.MoveCursor(1,1)
				tm.Flush()
				t.ResetRows()
				for idx, g := range gs.Keys {
					info, ok := hbByGuardian[g.String()]
					if ok {
						t.AppendRow(table.Row{idx, info.nodeName, info.version, strings.Join(info.features, ", "), info.counter, info.bootTimestamp, info.timestamp, g})
					} else {
						t.AppendRow(table.Row{idx, "", "", "", "", "", "", g})
					}
				}
				t.Render()
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
		if err := supervisor.Run(ctx, "p2p", p2p.Run(obsvC, obsvReqC, nil, sendC, signedInC, priv, nil, gst, p2pPort, p2pNetworkID, p2pBootstrap, "", false, rootCtxCancel, nil, govConfigC, govStatusC)); err != nil {
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
