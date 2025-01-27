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
	eth_common "github.com/ethereum/go-ethereum/common"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"

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
	p2pNetworkID = p2p.MainnetNetworkId
	p2pBootstrap = p2p.MainnetBootstrapPeers
	p2pPort = 8999
	nodeKeyPath = "/tmp/node.key"
	logLevel = "info"
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

	// Inbound observations
	batchObsvC := make(chan *common.MsgWithTimeStamp[gossipv1.SignedObservationBatch], 1024)

	// Guardian set state managed by processor
	gst := common.NewGuardianSetState(nil)

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

	obsvByHash := map[string]map[string]time.Time{}

	// Handle observations
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case batch := <-batchObsvC:
				for _, o := range batch.Msg.Observations {
					if o.MessageId[:3] != "26/" && o.MessageId[:2] != "7/" {
						ga := eth_common.BytesToAddress(batch.Msg.Addr).String()
						if _, ok := obsvByHash[o.MessageId]; !ok {
							obsvByHash[o.MessageId] = map[string]time.Time{}
						}
						if _, ok := obsvByHash[o.MessageId][ga]; !ok {
							obsvByHash[o.MessageId][ga] = time.Now()
						}
						logger.Warn("status", zap.String("id", o.MessageId), zap.Any("msg", obsvByHash[o.MessageId]))
					}
				}
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
	logger.Info("root context cancelled, exiting...")
	// TODO: wait for things to shut down gracefully

}
