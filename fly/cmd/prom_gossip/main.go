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

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
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

type guardianEntry struct {
	index   int
	name    string
	address string
}

var mainnetGuardians = []guardianEntry{
	{0, "RockawayX", "0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3"},
	{1, "Staked", "0xfF6CB952589BDE862c25Ef4392132fb9D4A42157"},
	{2, "Figment", "0x114De8460193bdf3A2fCf81f86a09765F4762fD1"},
	{3, "ChainodeTech", "0x107A0086b32d7A0977926A205131d8731D39cbEB"},
	{4, "Inotel", "0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2"},
	{5, "HashKey Cloud", "0x11b39756C042441BE6D8650b69b54EbE715E2343"},
	{6, "ChainLayer", "0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd"},
	{7, "xLabs", "0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20"},
	{8, "Forbole", "0x74a3bf913953D695260D88BC1aA25A4eeE363ef0"},
	{9, "Staking Fund", "0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e"},
	{10, "Moonlet", "0xAF45Ced136b9D9e24903464AE889F5C8a723FC14"},
	{11, "P2P Validator", "0xf93124b7c738843CBB89E864c862c38cddCccF95"},
	{12, "01node", "0xD2CC37A4dc036a8D232b48f62cDD4731412f4890"},
	{13, "MCF", "0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811"},
	{14, "Everstake", "0x71AA1BE1D36CaFE3867910F99C09e347899C19C3"},
	{15, "Chorus One", "0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf"},
	{16, "syncnode", "0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8"},
	{17, "Triton", "0x5E1487F35515d02A92753504a8D75471b9f49EdB"},
	{18, "Staking Facilities", "0x6FbEBc898F403E4773E95feB15E80C9A99c8348d"},
}

// Although there are multiple testnet guardians running, they all use the same key, so it looks like one.
var testnetGuardians = []guardianEntry{
	{0, "Testnet", "0x13947Bd48b18E53fdAeEe77F3473391aC727C638"},
}

var devnetGuardians = []guardianEntry{
	{0, "guardian-0", "0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe"},
	{1, "guardian-1", "0x88D7D8B32a9105d228100E72dFFe2Fae0705D31c"},
	{2, "guardian-2", "0x58076F561CC62A47087B567C86f986426dFCD000"},
	{3, "guardian-3", "0xBd6e9833490F8fA87c733A183CD076a6cBD29074"},
	{4, "guardian-4", "0xb853FCF0a5C78C1b56D15fCE7a154e6ebe9ED7a2"},
	{5, "guardian-5", "0xAF3503dBD2E37518ab04D7CE78b630F98b15b78a"},
	{6, "guardian-6", "0x785632deA5609064803B1c8EA8bB2c77a6004Bd1"},
	{7, "guardian-7", "0x09a281a698C0F5BA31f158585B41F4f33659e54D"},
	{8, "guardian-8", "0x3178443AB76a60E21690DBfB17f7F59F09Ae3Ea1"},
	{9, "guardian-9", "0x647ec26ae49b14060660504f4DA1c2059E1C5Ab6"},
	{10, "guardian-10", "0x810AC3D8E1258Bd2F004a94Ca0cd4c68Fc1C0611"},
	{11, "guardian-11", "0x80610e96d645b12f47ae5cf4546b18538739e90F"},
	{12, "guardian-12", "0x2edb0D8530E31A218E72B9480202AcBaeB06178d"},
	{13, "guardian-13", "0xa78858e5e5c4705CdD4B668FFe3Be5bae4867c9D"},
	{14, "guardian-14", "0x5Efe3A05Efc62D60e1D19fAeB56A80223CDd3472"},
	{15, "guardian-15", "0xD791b7D32C05aBB1cc00b6381FA0c4928f0c56fC"},
	{16, "guardian-16", "0x14Bc029B8809069093D712A3fd4DfAb31963597e"},
	{17, "guardian-17", "0x246Ab29FC6EBeDf2D392a51ab2Dc5C59d0902A03"},
	{18, "guardian-18", "0x132A84dFD920b35a3D0BA5f7A0635dF298F9033e"},
}

var (
	gossipByType = promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gossip_by_type_total",
			Help: "The total number of gossip messages by type",
	}, []string{"type"})
	uniqueObservationsGauge = promauto.NewGauge(prometheus.GaugeOpts{
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
	uniqueVAAsGauge = promauto.NewGauge(prometheus.GaugeOpts{
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

	env, err := common.ParseEnvironment(*envStr)
	if err != nil || (env != common.UnsafeDevNet && env != common.TestNet && env != common.MainNet) {
		if *envStr == "" {
			logger.Fatal("Please specify --env")
		}
		logger.Fatal("Invalid value for --env, should be devnet, testnet or mainnet", zap.String("val", *envStr))
	}

	// Build the set of guardians based on our environment, where the default is mainnet.
	var guardians []guardianEntry
	var knownEmitter []sdk.EmitterInfo
	if env == common.MainNet {
		guardians = mainnetGuardians
		knownEmitter = sdk.KnownEmitters
		rpcUrl = "https://rpc.ankr.com/eth"
		coreBridgeAddr = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B"
	} else if env == common.TestNet {
		guardians = testnetGuardians
		knownEmitter = sdk.KnownTestnetEmitters
		rpcUrl = "https://rpc.ankr.com/eth_holesky"
		coreBridgeAddr = "0xa10f2eF61dE1f19f586ab8B6F2EbA89bACE63F7a"
	} else if env == common.UnsafeDevNet {
		guardians = devnetGuardians
		knownEmitter = sdk.KnownDevnetEmitters
		rpcUrl = "http://localhost:8545"
		coreBridgeAddr = "0xC89Ce4735882C9F0f0FE26686c53074E09B0D550"
	}

	for _, gse := range guardians {
		guardianIndexToNameMap[gse.index] = gse.name
		guardianIndexMap[strings.ToLower(gse.address)] = gse.index
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

	// Outbound gossip message queue
	sendC := make(chan []byte)

	// Inbound observations
	obsvC := make(chan *common.MsgWithTimeStamp[gossipv1.SignedObservation], 20000)

	// Inbound observation requests
	obsvReqC := make(chan *gossipv1.ObservationRequest, 20000)

	// Inbound signed VAAs
	signedInC := make(chan *gossipv1.SignedVAAWithQuorum, 20000)

	// Heartbeat updates
	heartbeatC := make(chan *gossipv1.Heartbeat, 20000)

	// Guardian set state managed by processor
	gst := common.NewGuardianSetState(heartbeatC)

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
	gs := common.GuardianSet{
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
		uniqueObs := map[string]struct{}{}
		for {
			select {
			case <-rootCtx.Done():
				return
			case o := <-obsvC:
				gossipByType.WithLabelValues("observation").Inc()
				spl := strings.Split(o.Msg.MessageId, "/")
				chain, err := parseChainID(spl[0])
				if err != nil {
					chain = vaa.ChainIDUnset
				}
				emitter := strings.ToLower(spl[1])
				addr := "0x" + string(hex.EncodeToString(o.Msg.Addr))
				idx := guardianIndexMap[strings.ToLower(addr)]
				name := guardianIndexToNameMap[idx]
				observationsByGuardianPerChain.WithLabelValues(name, chain.String()).Inc()
				if knownEmitters[emitter] {
					tbObservationsByGuardianPerChain.WithLabelValues(name, chain.String()).Inc()
				}
				uniqueObs[hex.EncodeToString(o.Msg.Hash)] = struct{}{}
				uniqueObservationsGauge.Set(float64(len(uniqueObs)))
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
		uniqueVAAs := map[string]struct{}{}
		for {
			select {
			case <-rootCtx.Done():
				return
			case m := <-signedInC:
				// This only has VAABytes. It doesn't have the guardian address
				gossipByType.WithLabelValues("vaa").Inc()
				v, err := vaa.Unmarshal(m.Vaa)
				if err != nil {
					logger.Warn("received invalid VAA in SignedVAAWithQuorum message", zap.Error(err), zap.Any("message", m))
				} else {
					uniqueVAAs[v.HexDigest()] = struct{}{}
					uniqueVAAsGauge.Set(float64(len(uniqueVAAs)))
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
				idx := guardianIndexMap[strings.ToLower(addr)]
				name := guardianIndexToNameMap[idx]
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
				idx := guardianIndexMap[strings.ToLower(addr)]
				name := guardianIndexToNameMap[idx]
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
	priv, err = common.GetOrCreateNodeKey(logger, *nodeKeyPath)
	if err != nil {
		logger.Fatal("Failed to load node key", zap.Error(err))
	}

	// Run supervisor.
	components := p2p.DefaultComponents()
	components.Port = *p2pPort
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
				*p2pNetworkID,
				*p2pBootstrap,
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
