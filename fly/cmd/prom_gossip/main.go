// TODO: this currently leverages `p2p.Run` for gathering messages,
// but this abtracts away some critical metrics that would be advantageous to track, for example
// - getting raw counts for heartbeats (only guardian heartbeats are counted)
// - getting the sender's p2p key for VAAs (these are not currently attributed)
// - attributing messages to p2p key instead of guardian address (the guardian address field is currently unverified)
// - mapping p2p key to guardian address (is is possible for the same guardian key to have multiple p2p keys, such as testnet)
// manually connecting to the gossip network here would allow for the flexibility to do the above
// at cost of the added complexity of verifying guardian heartbeats to determine their legitimate p2p key(s)

package main

import (
	"context"
	"encoding/hex"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	node_common "github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"
	"github.com/wormhole-foundation/wormhole/sdk"
	"github.com/wormhole-foundation/wormhole/sdk/vaa"

	"go.uber.org/zap"
)

var (
	envStr       = flag.String("env", "mainnet", `environment (may be "mainnet", "testnet" or "devnet", required)`)
	logLevel     = flag.String("logLevel", "warn", "Logging level (debug, info, warn, error, dpanic, panic, fatal)")
	p2pNetworkID = flag.String("network", "", "P2P network identifier (optional, overrides default, required for devnet)")
	p2pPort      = flag.Uint("port", 8999, "P2P UDP listener port")
	p2pBootstrap = flag.String("bootstrap", "", "P2P bootstrap peers (optional, overrides default)")
	nodeKeyPath  = flag.String("nodeKey", "/tmp/node.key", "Path to node key (will be generated if it doesn't exist)")
	ethRPC       = flag.String("ethRPC", "", "Ethereum RPC for fetching current guardian set (default is based on env)")
	ethContract  = flag.String("ethContract", "", "Ethereum core bridge address for fetching current guardian set (default is based on env)")
)

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc

	rpcUrl         string
	coreBridgeAddr string

	numGuardians int

	// Guardian address to index map
	guardianIndexMap = map[string]int{}

	// Guardian index to address map
	guardianIndexToNameMap = map[int]string{}

	// The known token bridge emitters
	knownEmitters = map[string]bool{}
)

var (
	gossipByType = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gossip_by_type_total",
		Help: "The total number of gossip messages by type",
	}, []string{"type"})
	uniqueObservationsCounter = promauto.NewCounter(prometheus.CounterOpts{
		Name: "gossip_observations_unique_total",
		Help: "The unique number of observations received over gossip",
	})
	observationsByGuardianPerChain = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gossip_observations_by_guardian_per_chain_total",
		Help: "The number of observations received over gossip by guardian, per chain",
	}, []string{"guardian_name", "chain_name"})
	tbObservationsByGuardianPerChain = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gossip_token_bridge_observations_by_guardian_per_chain_total",
		Help: "The number of token bridge observations received over gossip by guardian, per chain",
	}, []string{"guardian_name", "chain_name"})
	observationRequestsPerChain = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gossip_observation_requests_per_chain_total",
		Help: "The number of observation requests received over gossip per chain",
	}, []string{"chain_name"})
	uniqueVAAsCounter = promauto.NewCounter(prometheus.CounterOpts{
		Name: "gossip_vaas_unique_total",
		Help: "The unique number of vaas received over gossip",
	})
	heartbeatsByGuardian = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gossip_heartbeats_by_guardian_total",
		Help: "The number of heartbeats received over gossip by guardian",
	}, []string{"guardian_name"})
	govConfigByGuardian = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gossip_gov_config_by_guardian_total",
		Help: "The number of heartbeats received over gossip by guardian",
	}, []string{"guardian_name"})
	govStatusByGuardian = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gossip_gov_status_by_guardian_total",
		Help: "The number of heartbeats received over gossip by guardian",
	}, []string{"guardian_name"})
)

func main() {
	flag.Parse()

	// Set up the logger.
	lvl, err := ipfslog.LevelFromString(*logLevel)
	if err != nil {
		fmt.Println("Invalid log level")
		os.Exit(1)
	}

	logger := ipfslog.Logger("wormhole-fly").Desugar()
	ipfslog.SetAllLoggers(lvl)

	if *envStr == "" {
		logger.Fatal("--env is required")
	}

	env, err := node_common.ParseEnvironment(*envStr)
	if err != nil || (env != node_common.UnsafeDevNet && env != node_common.TestNet && env != node_common.MainNet) {
		if *envStr == "" {
			logger.Fatal("Please specify --env")
		}
		logger.Fatal("Invalid value for --env, should be devnet, testnet or mainnet", zap.String("val", *envStr))
	}

	// Build the set of guardians based on our environment, where the default is mainnet.
	var guardians []common.GuardianEntry
	var knownEmitter []sdk.EmitterInfo
	if env == node_common.MainNet {
		guardians = common.MainnetGuardians
		knownEmitter = sdk.KnownEmitters
		rpcUrl = "https://ethereum-rpc.publicnode.com"
		coreBridgeAddr = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B"
	} else if env == node_common.TestNet {
		guardians = common.TestnetGuardians
		knownEmitter = sdk.KnownTestnetEmitters
		rpcUrl = "https://ethereum-holesky-rpc.publicnode.com"
		coreBridgeAddr = "0xa10f2eF61dE1f19f586ab8B6F2EbA89bACE63F7a"
	} else if env == node_common.UnsafeDevNet {
		guardians = common.DevnetGuardians
		knownEmitter = sdk.KnownDevnetEmitters
		rpcUrl = "http://localhost:8545"
		coreBridgeAddr = "0xC89Ce4735882C9F0f0FE26686c53074E09B0D550"
	}

	for _, gse := range guardians {
		guardianIndexToNameMap[gse.Index] = gse.Name
		guardianIndexMap[strings.ToLower(gse.Address)] = gse.Index
	}

	// Fill in the known emitters
	for _, knownEmitter := range knownEmitter {
		knownEmitters[strings.ToLower(knownEmitter.Emitter)] = true
	}

	numGuardians = len(guardianIndexToNameMap)

	// Set up P2P.
	if *p2pNetworkID == "" {
		*p2pNetworkID = p2p.GetNetworkId(env)
	}

	if *p2pBootstrap == "" {
		*p2pBootstrap, err = p2p.GetBootstrapPeers(env)
		if err != nil {
			logger.Fatal("failed to determine the bootstrap peers from the environment", zap.String("env", string(env)), zap.Error(err))
		}
	}

	// If they specified the RPC or contract address, override the defaults.
	if *ethRPC != "" {
		rpcUrl = *ethRPC
	}
	if *ethContract != "" {
		coreBridgeAddr = *ethContract
	}

	// Node's main lifecycle context.
	rootCtx, rootCtxCancel = context.WithCancel(context.Background())
	defer rootCtxCancel()

	// Inbound observations
	batchObsvC := make(chan *node_common.MsgWithTimeStamp[gossipv1.SignedObservationBatch], 20000)

	// Inbound observation requests
	obsvReqC := make(chan *gossipv1.ObservationRequest, 20000)

	// Inbound signed VAAs
	signedInC := make(chan *gossipv1.SignedVAAWithQuorum, 20000)

	// Heartbeat updates
	heartbeatC := make(chan *gossipv1.Heartbeat, 20000)

	// Guardian set state managed by processor
	gst := node_common.NewGuardianSetState(heartbeatC)

	// Governor cfg
	govConfigC := make(chan *gossipv1.SignedChainGovernorConfig, 20000)

	// Governor status
	govStatusC := make(chan *gossipv1.SignedChainGovernorStatus, 20000)
	// Bootstrap guardian set, otherwise heartbeats would be skipped
	idx, sgs, err := utils.FetchCurrentGuardianSet(rpcUrl, coreBridgeAddr)
	if err != nil {
		logger.Fatal("Failed to fetch guardian set", zap.Error(err))
	}
	logger.Info("guardian set", zap.Uint32("index", idx), zap.Any("gs", sgs))
	gs := node_common.GuardianSet{
		Keys:  sgs.Keys,
		Index: idx,
	}
	gst.Set(&gs)

	if len(gs.Keys) != numGuardians {
		logger.Error("Invalid number of guardians.", zap.Int("found", len(gs.Keys)), zap.Int("expected", numGuardians))
		return
	}

	// Count observations
	go func() {
		// TODO: move this to a function / struct with a mutex so that the cleanup can be run independently from the message handling, so as to not back up the channel
		uniqueObs := make(map[string]time.Time)
		timeout := time.Hour
		delay := time.Minute * 10
		timer := time.NewTimer(delay)
		defer timer.Stop()
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-timer.C:
				beforeCount := len(uniqueObs)
				now := time.Now()
				for hash, t := range uniqueObs {
					if now.After(t.Add(timeout)) {
						delete(uniqueObs, hash)
					}
				}
				afterCount := len(uniqueObs)
				logger.Info("Cleaned up unique observations cache", zap.Int("beforeCount", beforeCount), zap.Int("afterCount", afterCount), zap.Int("cleanedUpCount", beforeCount-afterCount))
				timer.Reset(delay)
			case batch := <-batchObsvC:
				gossipByType.WithLabelValues("batch_observation").Inc()
				addr := "0x" + string(hex.EncodeToString(batch.Msg.Addr))
				name := addr
				idx, found := guardianIndexMap[strings.ToLower(addr)]
				if found {
					name = guardianIndexToNameMap[idx]
				}
				for _, o := range batch.Msg.Observations {
					spl := strings.Split(o.MessageId, "/")
					chain, err := parseChainID(spl[0])
					if err != nil {
						chain = vaa.ChainIDUnset
					}
					emitter := strings.ToLower(spl[1])
					observationsByGuardianPerChain.WithLabelValues(name, chain.String()).Inc()
					if knownEmitters[emitter] {
						tbObservationsByGuardianPerChain.WithLabelValues(name, chain.String()).Inc()
					}
					hash := hex.EncodeToString(o.Hash)
					if _, exists := uniqueObs[hash]; !exists {
						uniqueObservationsCounter.Inc()
					}
					uniqueObs[hash] = time.Now()
				}
			}
		}
	}()

	// Count observation requests
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case or := <-obsvReqC:
				// There is no guardian address in the observation request
				gossipByType.WithLabelValues("observation_request").Inc()
				chain := vaa.ChainID(or.ChainId)
				observationRequestsPerChain.WithLabelValues(chain.String()).Inc()
			}
		}
	}()

	// Count signed VAAs
	go func() {
		// TODO: move this to a function / struct with a mutex so that the cleanup can be run independently from the message handling, so as to not back up the channel
		uniqueVAAs := make(map[string]time.Time)
		timeout := time.Hour
		delay := time.Minute * 10
		timer := time.NewTimer(delay)
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-timer.C:
				beforeCount := len(uniqueVAAs)
				now := time.Now()
				for hash, t := range uniqueVAAs {
					if now.After(t.Add(timeout)) {
						delete(uniqueVAAs, hash)
					}
				}
				afterCount := len(uniqueVAAs)
				logger.Info("Cleaned up unique VAAs cache", zap.Int("beforeCount", beforeCount), zap.Int("afterCount", afterCount), zap.Int("cleanedUpCount", beforeCount-afterCount))
				timer.Reset(delay)
			case m := <-signedInC:
				// This only has VAABytes. It doesn't have the guardian address
				gossipByType.WithLabelValues("vaa").Inc()
				v, err := vaa.Unmarshal(m.Vaa)
				if err != nil {
					logger.Warn("received invalid VAA in SignedVAAWithQuorum message", zap.Error(err), zap.Any("message", m))
				} else {
					digest := v.HexDigest()
					if _, exists := uniqueVAAs[digest]; exists {
						uniqueVAAsCounter.Inc()
					}
					uniqueVAAs[digest] = time.Now()
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
				gossipByType.WithLabelValues("heartbeat").Inc()
				idx := guardianIndexMap[strings.ToLower(hb.GuardianAddr)]
				name := guardianIndexToNameMap[idx]
				heartbeatsByGuardian.WithLabelValues(name).Inc()
			}
		}
	}()

	// Count govConfigs
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case g := <-govConfigC:
				gossipByType.WithLabelValues("gov_config").Inc()
				addr := "0x" + string(hex.EncodeToString(g.GuardianAddr))
				name := addr
				idx, found := guardianIndexMap[strings.ToLower(addr)]
				if found {
					name = guardianIndexToNameMap[idx]
				}
				govConfigByGuardian.WithLabelValues(name).Inc()
			}
		}
	}()

	// Count govStatus
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case g := <-govStatusC:
				gossipByType.WithLabelValues("gov_status").Inc()
				addr := "0x" + string(hex.EncodeToString(g.GuardianAddr))
				name := addr
				idx, found := guardianIndexMap[strings.ToLower(addr)]
				if found {
					name = guardianIndexToNameMap[idx]
				}
				govStatusByGuardian.WithLabelValues(name).Inc()
			}
		}
	}()

	// Start prometheus server
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		http.ListenAndServe(":2112", nil)
	}()

	// Load p2p private key
	var priv crypto.PrivKey
	priv, err = node_common.GetOrCreateNodeKey(logger, *nodeKeyPath)
	if err != nil {
		logger.Fatal("Failed to load node key", zap.Error(err))
	}

	// Run supervisor.
	components := p2p.DefaultComponents()
	components.Port = *p2pPort

	params, err := p2p.NewRunParams(
		*p2pBootstrap,
		*p2pNetworkID,
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
	logger.Info("root context cancelled, exiting...")
}

// parseChainID parses a human-readable chain name or a chain ID.
func parseChainID(name string) (vaa.ChainID, error) {
	s, err := vaa.ChainIDFromString(name)
	if err == nil {
		return s, nil
	}

	// parse as uint16
	i, err := strconv.ParseUint(name, 10, 16)
	if err != nil {
		return 0, fmt.Errorf("failed to parse as name or uint16: %v", err)
	}

	return vaa.ChainID(i), nil
}
