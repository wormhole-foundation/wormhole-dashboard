package main

import (
	"context"
	"fmt"
	"os"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"
	"go.uber.org/zap"
)

type Fly interface {
	// called once at the beginning, no setter
	GetConfig() Config
	// match logger
	SetLogger(*zap.Logger)
	Logger() *zap.Logger
	// handlers
	HandleObservation(obs *gossipv1.SignedObservation)
	HandleObservationRequest(obsReq *gossipv1.ObservationRequest)
	HandleSignedVAAWithQuorum(vaa *gossipv1.SignedVAAWithQuorum)
	HandleHeartbeat(hb *gossipv1.Heartbeat)
	HandleGovernorConfig(gc *gossipv1.SignedChainGovernorConfig)
	HandleGovernorStatus(gs *gossipv1.SignedChainGovernorStatus)
}

type DefaultFly struct {
	logger *zap.Logger
}

// ensure the DefaultFly implements the interface
var _ Fly = &DefaultFly{}

func (*DefaultFly) GetConfig() Config         { return DefaultMainnetConfig() }
func (d *DefaultFly) SetLogger(l *zap.Logger) { d.logger = l }
func (d *DefaultFly) Logger() *zap.Logger     { return d.logger }

// NoOp by default, just implement the interface
func (*DefaultFly) HandleGovernorConfig(gc *gossipv1.SignedChainGovernorConfig)  {}
func (*DefaultFly) HandleGovernorStatus(gs *gossipv1.SignedChainGovernorStatus)  {}
func (*DefaultFly) HandleHeartbeat(hb *gossipv1.Heartbeat)                       {}
func (*DefaultFly) HandleObservation(obs *gossipv1.SignedObservation)            {}
func (*DefaultFly) HandleObservationRequest(obsReq *gossipv1.ObservationRequest) {}
func (*DefaultFly) HandleSignedVAAWithQuorum(vaa *gossipv1.SignedVAAWithQuorum)  {}

func Launch(fly Fly) {
	var (
		rootCtx       context.Context
		rootCtxCancel context.CancelFunc
		cfg           = fly.GetConfig()
	)

	lvl, err := ipfslog.LevelFromString(cfg.LogLevel)
	if err != nil {
		fmt.Println("Invalid log level")
		os.Exit(1)
	}
	logger := ipfslog.Logger("wormhole-fly").Desugar()
	ipfslog.SetAllLoggers(lvl)
	fly.SetLogger(logger)

	// Node's main lifecycle context.
	rootCtx, rootCtxCancel = context.WithCancel(context.Background())
	defer rootCtxCancel()

	// Outbound gossip message queue
	sendC := make(chan []byte)
	// Inbound observations
	obsvC := make(chan *gossipv1.SignedObservation, cfg.ChannelBuffer)
	// Inbound observation requests
	obsvReqC := make(chan *gossipv1.ObservationRequest, cfg.ChannelBuffer)
	// Inbound signed VAAs
	signedInC := make(chan *gossipv1.SignedVAAWithQuorum, cfg.ChannelBuffer)
	// Heartbeat updates
	heartbeatC := make(chan *gossipv1.Heartbeat, cfg.ChannelBuffer)
	// Governor cfg
	govConfigC := make(chan *gossipv1.SignedChainGovernorConfig, cfg.ChannelBuffer)
	// Governor status
	govStatusC := make(chan *gossipv1.SignedChainGovernorStatus, cfg.ChannelBuffer)

	// Bootstrap guardian set, otherwise heartbeats would be skipped
	idx, sgs, err := utils.FetchCurrentGuardianSet()
	if err != nil {
		logger.Fatal("Failed to fetch guardian set", zap.Error(err))
	}
	logger.Info("guardian set", zap.Uint32("index", idx), zap.Any("gs", sgs))

	// Guardian set state managed by processor
	gst := common.NewGuardianSetState(heartbeatC)
	gst.Set(&common.GuardianSet{Keys: sgs.Keys, Index: idx})

	// Handle observations
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case o := <-obsvC:
				fly.HandleObservation(o)
			}
		}
	}()

	// Handle observation requests
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case req := <-obsvReqC:
				fly.HandleObservationRequest(req)
			}
		}
	}()

	// Handle VAAs
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case vaa := <-signedInC:
				fly.HandleSignedVAAWithQuorum(vaa)
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
				fly.HandleHeartbeat(hb)
			}
		}
	}()

	// Handle govConfigs
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case gc := <-govConfigC:
				fly.HandleGovernorConfig(gc)
			}
		}
	}()

	// Handle govStatus
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case gs := <-govStatusC:
				fly.HandleGovernorStatus(gs)
			}
		}
	}()

	// Load p2p private key
	var priv crypto.PrivKey
	priv, err = common.GetOrCreateNodeKey(logger, cfg.NodeKeyPath)
	if err != nil {
		logger.Fatal("Failed to load node key", zap.Error(err))
	}

	// Run supervisor.
	supervisor.New(rootCtx, logger, func(ctx context.Context) error {
		err := supervisor.Run(
			ctx,
			"p2p",
			p2p.Run(
				obsvC,
				obsvReqC,
				nil,
				sendC,
				signedInC,
				priv,
				nil,
				gst,
				cfg.P2PPort,
				cfg.P2PNetworkID,
				cfg.P2PBootstrap,
				"",
				false,
				rootCtxCancel,
				nil,
				govConfigC,
				govStatusC,
			),
		)
		if err != nil {
			return err
		}
		logger.Info("Started internal services")

		<-ctx.Done()
		return nil
		// It's safer to crash and restart the process in case we encounter a panic,
		// rather than attempting to reschedule the runnable.
	}, supervisor.WithPropagatePanic)
	<-rootCtx.Done()
	logger.Info("root context cancelled, exiting...")
}
