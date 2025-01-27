// This program listens to the gossip network and counts the number of messages per second
// Run the program as follows:
// go run trackGossip.go

package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"

	"github.com/libp2p/go-libp2p/core/crypto"

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

func main() {
	// TODO: pass in config instead of hard-coding it
	// main
	p2pNetworkID = p2p.MainnetNetworkId
	p2pBootstrap = p2p.MainnetBootstrapPeers
	// devnet
	// p2pNetworkID = "/wormhole/dev"
	// p2pBootstrap = "/dns4/guardian-0.guardian/udp/8999/quic/p2p/12D3KooWL3XJ9EMCyZvmmGXL2LMiVBtrVa2BuESsJiXkSj7333Jw"
	p2pPort = 8999
	nodeKeyPath = "/tmp/node.key"
	logLevel = "info"
	// common.SetRestrictiveUmask()
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

	logger.Info("Starting up")

	// Verify flags
	if nodeKeyPath == "" {
		logger.Fatal("Please specify --nodeKey")
	}
	if p2pBootstrap == "" {
		logger.Fatal("Please specify --bootstrap")
	}

	// Node's main lifecycle context.
	rootCtx, rootCtxCancel = context.WithCancel(context.Background())
	defer rootCtxCancel()

	// Inbound observations
	batchObsvC := make(chan *common.MsgWithTimeStamp[gossipv1.SignedObservationBatch], 1024)

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
	idx, gs, err := utils.FetchCurrentGuardianSet(*rpcUrl, *coreBridgeAddr)
	if err != nil {
		logger.Fatal("Failed to fetch guardian set", zap.Error(err))
	}
	logger.Info("guardian set", zap.Uint32("index", idx), zap.Any("gs", gs))
	gst.Set(&common.GuardianSet{
		Keys:  gs.Keys,
		Index: idx,
	})

	numObs := 0
	numObsReq := 0
	numSigned := 0
	numHeartbeat := 0
	numGovConfig := 0
	numGovStatus := 0

	// Count various message types.
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case batch := <-batchObsvC:
				numObs += len(batch.Msg.Observations)
			case <-signedInC:
				numSigned++
			case <-obsvReqC:
				numObsReq++
			case <-heartbeatC:
				numHeartbeat++
			case <-govConfigC:
				numGovConfig++
			case <-govStatusC:
				numGovStatus++
			}
		}
	}()

	// Print and reset stats periodically.
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-ticker.C:
				logger.Info(
					"Stats",
					zap.Int("numObs", numObs),
					zap.Int("numObsReq", numObsReq),
					zap.Int("numSigned", numSigned),
					zap.Int("numHeartbeat", numHeartbeat),
					zap.Int("numGovConfig", numGovConfig),
					zap.Int("numGovStatus", numGovStatus),
				)
				numObs = 0
				numObsReq = 0
				numSigned = 0
				numHeartbeat = 0
				numGovConfig = 0
				numGovStatus = 0
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

	params, err := p2p.NewRunParams(
		p2pBootstrap,
		p2pNetworkID,
		priv,
		gst,
		rootCtxCancel,
		p2p.WithComponents(components),
		p2p.WithSignedObservationBatchListener(batchObsvC),
		p2p.WithSignedVAAListener(signedInC),
		p2p.WithObservationRequestListener(obsvReqC),
		p2p.WithChainGovernorConfigListener(govConfigC),
		p2p.WithChainGovernorStatusListener(govStatusC),
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
	logger.Info("root context cancelled, sleeping...")
	time.Sleep(2 * time.Second)
	logger.Info("done sleeping, exiting")
	// TODO: wait for things to shut down gracefully

}
