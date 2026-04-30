package main

import (
	"context"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	eth_common "github.com/ethereum/go-ethereum/common"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/joho/godotenv"
	"github.com/libp2p/go-libp2p/core/crypto"
	fly_common "github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"

	"go.uber.org/zap"

	"log"

	firebase "firebase.google.com/go"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/protobuf/proto"
)

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc
)

var (
	p2pNetworkID    string
	p2pPort         uint
	p2pBootstrap    string
	nodeKeyPath     string
	logLevel        string
	rpcUrl          string
	coreBridgeAddr  string
	credentialsFile string
	network         string
)

func loadEnvVars() {
	err := godotenv.Load() // By default loads .env
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	port, err := strconv.ParseUint(verifyEnvVar("P2P_PORT"), 10, 32)
	if err != nil {
		log.Fatal("Error parsing P2P_PORT")
	}
	p2pPort = uint(port)
	nodeKeyPath = verifyEnvVar("NODE_KEY_PATH")
	logLevel = verifyEnvVar("LOG_LEVEL")
	rpcUrl = verifyEnvVar("RPC_URL")
	coreBridgeAddr = verifyEnvVar("CORE_BRIDGE_ADDR")
	credentialsFile = verifyEnvVar("CREDENTIALS_FILE")
	network = verifyEnvVar("NETWORK")
}

func verifyEnvVar(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("%s must be specified", key)
	}
	return value
}

func main() {
	loadEnvVars()

	lvl, err := ipfslog.LevelFromString(logLevel)
	if err != nil {
		fmt.Println("Invalid log level")
		os.Exit(1)
	}

	logger := ipfslog.Logger("wormhole-fly").Desugar()

	env, err := common.ParseEnvironment(network)
	if err != nil || (env != common.TestNet && env != common.MainNet) {
		logger.Fatal("Invalid value for NETWORK, should be testnet or mainnet", zap.String("val", network))
	}
	p2pNetworkID = p2p.GetNetworkId(env)
	p2pBootstrap, err = p2p.GetBootstrapPeers(env)
	if err != nil {
		logger.Fatal("failed to determine the bootstrap peers from the environment", zap.String("env", string(env)), zap.Error(err))
	}

	ipfslog.SetAllLoggers(lvl)

	ctx := context.Background()
	sa := option.WithCredentialsFile(credentialsFile)
	app, err := firebase.NewApp(ctx, nil, sa)
	if err != nil {
		log.Fatalln(err)
	}

	client, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalln(err)
	}
	defer client.Close()

	// Node's main lifecycle context.
	rootCtx, rootCtxCancel = context.WithCancel(context.Background())
	defer rootCtxCancel()

	// Heartbeat updates
	heartbeatC := make(chan *gossipv1.Heartbeat, 50)

	// Guardian set state managed by processor
	gst := common.NewGuardianSetState(heartbeatC)

	// Governor cfg
	govConfigC := make(chan *gossipv1.SignedChainGovernorConfig, 50)

	// Governor status
	govStatusC := make(chan *gossipv1.SignedChainGovernorStatus, 50)
	// Bootstrap guardian set, otherwise heartbeats would be skipped
	idx, sgs, err := utils.FetchCurrentGuardianSet(rpcUrl, coreBridgeAddr)
	if err != nil {
		logger.Fatal("Failed to fetch guardian set", zap.String("rpc", rpcUrl), zap.Error(err))
	}
	if env == common.MainNet {
		// watch heartbeats for standby guardians
		for _, ge := range fly_common.StandbyMainnetGuardians {
			sgs.Keys = append(sgs.Keys, eth_common.HexToAddress(ge.Address))
		}
	}
	logger.Info("guardian set", zap.Uint32("index", idx), zap.Any("gs", sgs))
	gs := common.GuardianSet{
		Keys:  sgs.Keys,
		Index: idx,
	}
	gst.Set(&gs)

	notionalByChainMu := sync.Mutex{}
	availableNotionalByChain := map[string]map[uint32]uint64{}

	type latestHeartbeat struct {
		bootTimestamp int64
		counter       int64
	}

	// Holds the most recent heartbeat (time-wise, not reception-wise) (NodeName → last seen)
	lastHeartbeat := map[string]latestHeartbeat{}

	// Seed most recent heartbeats from existing Firestore data
	iter := client.Collection("heartbeats").Documents(ctx)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			logger.Info("Error reading heartbeats for seeding", zap.Error(err))
			break
		}
		data := doc.Data()
		nodeName, _ := data["nodeName"].(string)
		counterStr, _ := data["counter"].(string)
		bootTsStr, _ := data["bootTimestamp"].(string)
		if nodeName == "" {
			continue
		}
		counter, _ := strconv.ParseInt(counterStr, 10, 64)
		bootTs, _ := strconv.ParseInt(bootTsStr, 10, 64)
		lastHeartbeat[nodeName] = latestHeartbeat{
			bootTimestamp: bootTs,
			counter:       counter,
		}
	}
	logger.Info("Seeded heartbeats from Firestore", zap.Int("count", len(lastHeartbeat)))

	// Handle heartbeats
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case hb := <-heartbeatC:
				id := hb.NodeName

				// Only write if this is a newer heartbeat than the last one we saw.
				// Accept if: new guardian (not seen before), newer boot cycle, or higher counter.
				prev, hasPrev := lastHeartbeat[id]
				if hasPrev {
					if hb.BootTimestamp < prev.bootTimestamp {
						continue
					}
					if hb.BootTimestamp == prev.bootTimestamp && hb.Counter <= prev.counter {
						continue
					}
				}

				// Update high-water mark
				lastHeartbeat[id] = latestHeartbeat{
					bootTimestamp: hb.BootTimestamp,
					counter:       hb.Counter,
				}

				// Look up the libp2p peer ID that sent this heartbeat. The p2p loop
				// stores (addr, peerID) → hb in gst.lastHeartbeats before sending hb
				// to our channel, so the same pointer should be in the map.
				p2pNodeAddr := ""
				for peerId, stored := range gst.LastHeartbeat(eth_common.HexToAddress(hb.GuardianAddr)) {
					if stored == hb {
						p2pNodeAddr = peerId.String()
						break
					}
				}

				now := time.Now()
				networks := make([]*map[string]interface{}, 0, len(hb.Networks))
				for _, network := range hb.Networks {
					networks = append(networks, &map[string]interface{}{
						"id":                      network.Id,
						"height":                  strconv.FormatInt(network.Height, 10),
						"contractAddress":         network.ContractAddress,
						"errorCount":              strconv.FormatUint(network.ErrorCount, 10),
						"safeHeight":              strconv.FormatInt(network.SafeHeight, 10),
						"finalizedHeight":         strconv.FormatInt(network.FinalizedHeight, 10),
						"lastObservationSignedAt": strconv.FormatInt(network.LastObservationSignedAt, 10),
					})
				}

				_, err = client.Collection("heartbeats").Doc(id).Set(ctx, map[string]interface{}{
					"bootTimestamp": strconv.FormatInt(hb.BootTimestamp, 10),
					"counter":       strconv.FormatInt(hb.Counter, 10),
					"features":      hb.Features,
					"guardianAddr":  hb.GuardianAddr,
					"networks":      networks,
					"nodeName":      hb.NodeName,
					"timestamp":     strconv.FormatInt(hb.Timestamp, 10),
					"updatedAt":     now,
					"version":       hb.Version,
					"p2pNodeAddr":   p2pNodeAddr,
				})
				if err != nil {
					// Handle any errors in an appropriate way, such as returning them.
					log.Printf("Error inserting heartbeat: %s", err)
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
			case govConfig := <-govConfigC:
				id := hex.EncodeToString(govConfig.GuardianAddr)
				_, isFromGuardian := gs.KeyIndex(eth_common.HexToAddress(id))
				if !isFromGuardian {
					log.Printf("gov cfg not from guardian set")
					continue
				}

				now := time.Now()
				var cfg gossipv1.ChainGovernorConfig
				err := proto.Unmarshal(govConfig.Config, &cfg)
				if err != nil {
					log.Printf("Error unmarshalling govr config: %s", err)
					continue
				}
				chains := make([]*map[string]interface{}, 0, len(cfg.Chains))
				for _, chain := range cfg.Chains {
					availableNotional := uint64(0)
					notionalByChainMu.Lock()
					if _, ok := availableNotionalByChain[id]; ok {
						if _, ok := availableNotionalByChain[id][chain.ChainId]; ok {
							availableNotional = availableNotionalByChain[id][chain.ChainId]
						}
					}
					notionalByChainMu.Unlock()
					chains = append(chains, &map[string]interface{}{
						"chainId":            chain.ChainId,
						"notionalLimit":      strconv.FormatUint(chain.NotionalLimit, 10),
						"bigTransactionSize": strconv.FormatUint(chain.BigTransactionSize, 10),
						// store the available notional in the same collection
						// as the notional limits since they're closely related
						// and is convenient for consumers
						"availableNotional": strconv.FormatUint(availableNotional, 10),
					})
				}
				tokens := make([]*map[string]interface{}, 0, len(cfg.Tokens))
				for _, token := range cfg.Tokens {
					tokens = append(tokens, &map[string]interface{}{
						"originChainId": token.OriginChainId,
						"originAddress": token.OriginAddress,
						"price":         token.Price,
					})
				}

				_, err = client.Collection("governorConfigs").Doc(id).Set(ctx, map[string]interface{}{
					"guardianAddress": hex.EncodeToString(govConfig.GuardianAddr),
					"chains":          chains,
					"tokens":          tokens,
					"updatedAt":       now,
				})

				if err != nil {
					log.Printf("Error inserting govr config: %s", err)
				}
			}
		}
	}()

	// Handle govStatus
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case govStatus := <-govStatusC:
				id := hex.EncodeToString(govStatus.GuardianAddr)
				_, isFromGuardian := gs.KeyIndex(eth_common.HexToAddress(id))
				if !isFromGuardian {
					log.Printf("gov status not from guardian set")
					continue
				}

				now := time.Now()
				var status gossipv1.ChainGovernorStatus
				err := proto.Unmarshal(govStatus.Status, &status)
				if err != nil {
					log.Printf("Error unmarshalling govr status: %s", err)
					continue
				}
				chains := make([]*map[string]interface{}, 0, len(status.Chains))
				for _, chain := range status.Chains {
					emitters := make([]*map[string]interface{}, 0, len(chain.Emitters))
					for _, emitter := range chain.Emitters {
						enqueuedVaas := make([]*map[string]interface{}, 0, len(emitter.EnqueuedVaas))
						for _, enqueuedVaa := range emitter.EnqueuedVaas {
							enqueuedVaas = append(enqueuedVaas, &map[string]interface{}{
								"sequence":      strconv.FormatUint(enqueuedVaa.Sequence, 10),
								"releaseTime":   enqueuedVaa.ReleaseTime,
								"notionalValue": strconv.FormatUint(enqueuedVaa.NotionalValue, 10),
								"txHash":        enqueuedVaa.TxHash,
							})
						}
						emitters = append(emitters, &map[string]interface{}{
							"emitterAddress":    emitter.EmitterAddress,
							"totalEnqueuedVaas": strconv.FormatUint(emitter.TotalEnqueuedVaas, 10),
							"enqueuedVaas":      enqueuedVaas,
						})
					}
					chains = append(chains, &map[string]interface{}{
						"chainId":           chain.ChainId,
						"availableNotional": strconv.FormatUint(chain.RemainingAvailableNotional, 10),
						"emitters":          emitters,
					})
					notionalByChainMu.Lock()
					if _, ok := availableNotionalByChain[id]; !ok {
						availableNotionalByChain[id] = map[uint32]uint64{}
					}
					availableNotionalByChain[id][chain.ChainId] = chain.RemainingAvailableNotional
					notionalByChainMu.Unlock()
				}

				_, err = client.Collection("governorStatus").Doc(id).Set(ctx, map[string]interface{}{
					"guardianAddress": hex.EncodeToString(govStatus.GuardianAddr),
					"chains":          chains,
					"updatedAt":       now,
				})

				if err != nil {
					log.Printf("Error inserting govr status: %s", err)
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
	// Reduce number of connected peers to reduce network egress
	components.GossipParams.D = 1    // default: 6
	components.GossipParams.Dlo = 1  // default: 5
	components.GossipParams.Dhi = 2  // default: 12
	components.GossipParams.Dout = 1 // default: 2

	params, err := p2p.NewRunParams(
		p2pBootstrap,
		p2pNetworkID,
		priv,
		gst,
		rootCtxCancel,
		p2p.WithComponents(components),
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
	// TODO: wait for things to shut down gracefully

}
