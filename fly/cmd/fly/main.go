package main

import (
	"context"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"cloud.google.com/go/bigtable"
	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	eth_common "github.com/ethereum/go-ethereum/common"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"
	"github.com/wormhole-foundation/wormhole/sdk/vaa"

	"go.uber.org/zap"

	"log"

	firebase "firebase.google.com/go"
	"google.golang.org/api/option"
	"google.golang.org/protobuf/proto"
)

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc
)

var (
	p2pNetworkID  string
	p2pPort       uint
	p2pBootstrap  string
	nodeKeyPath   string
	logLevel      string
	gcpProjectID  string
	gcpInstanceID string
)

// Make a bigtable row key from a VAA
// example: 00002/0000000000000000000000008ea8874192c8c715e620845f833f48f39b24e222/00000000000000000000
func makeRowKey(v *vaa.VAA) string {
	s := strconv.FormatUint(v.Sequence, 10)
	return fmt.Sprintf("%05d/%s/%020s", v.EmitterChain, v.EmitterAddress, s)
}

func writeSignedVAAsToBigtable(ctx context.Context, client *bigtable.Client, signedVAAs map[string][]byte, logger *zap.Logger) {
	tbl := client.Open("signedVAAs")
	muts := make([]*bigtable.Mutation, len(signedVAAs))
	rowKeys := make([]string, len(signedVAAs))
	i := 0
	for rowKey, bytes := range signedVAAs {
		muts[i] = bigtable.NewMutation()
		// write 0 timestamp to only keep 1 cell each
		// https://cloud.google.com/bigtable/docs/gc-latest-value
		muts[i].Set("info", "bytes", 0, bytes)
		rowKeys[i] = rowKey
		i++
	}
	// TODO: benchmark simple vs batch writes
	// https://cloud.google.com/bigtable/docs/writes#not-simple
	rowErrs, err := tbl.ApplyBulk(ctx, rowKeys, muts)
	if err != nil {
		logger.Error("Could not apply bulk row mutation", zap.Error(err))
	}
	if rowErrs != nil {
		for _, rowErr := range rowErrs {
			logger.Error("Error writing row", zap.Error(rowErr))
		}
		logger.Error("Could not write some rows")
	}
}

func main() {
	p2pNetworkID = "/wormhole/mainnet/2"
	p2pBootstrap = "/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7"
	p2pPort = 8999
	nodeKeyPath = "/tmp/node.key"
	logLevel = "warn"
	gcpProjectID = "wormhole-315720"
	gcpInstanceID = "wormhole-mainnet"

	lvl, err := ipfslog.LevelFromString(logLevel)
	if err != nil {
		fmt.Println("Invalid log level")
		os.Exit(1)
	}

	logger := ipfslog.Logger("wormhole-fly").Desugar()

	ipfslog.SetAllLoggers(lvl)

	// Verify flags
	if nodeKeyPath == "" {
		logger.Fatal("Please specify --nodeKey")
	}
	if p2pBootstrap == "" {
		logger.Fatal("Please specify --bootstrap")
	}

	// Use the application default credentials
	ctx := context.Background()
	sa := option.WithCredentialsFile("./serviceAccount.json")
	app, err := firebase.NewApp(ctx, nil, sa)
	if err != nil {
		log.Fatalln(err)
	}

	client, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalln(err)
	}
	defer client.Close()

	btClient, err := bigtable.NewClient(ctx, gcpProjectID, gcpInstanceID, sa)
	if err != nil {
		log.Fatalln(err)
	}
	defer btClient.Close()

	// Node's main lifecycle context.
	rootCtx, rootCtxCancel = context.WithCancel(context.Background())
	defer rootCtxCancel()

	// Outbound gossip message queue
	sendC := make(chan []byte)

	// Inbound observations
	obsvC := make(chan *gossipv1.SignedObservation, 50)

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

	notionalByChainMu := sync.Mutex{}
	availableNotionalByChain := map[string]map[uint32]uint64{}

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

	// Write signed VAAs to bigtable periodically
	go func() {
		signedVAAs := map[string][]byte{}
		ticker := time.NewTicker(time.Minute)
		var wg sync.WaitGroup
		defer ticker.Stop()
		for {
			select {
			case <-rootCtx.Done():
				wg.Wait()
				return
			case <-ticker.C:
				if len(signedVAAs) > 0 {
					wg.Add(1)
					go func(signedVAAs map[string][]byte) {
						writeSignedVAAsToBigtable(rootCtx, btClient, signedVAAs, logger)
						defer wg.Done()
					}(signedVAAs)
					signedVAAs = map[string][]byte{}
				}
			case m := <-signedInC:
				v, err := vaa.Unmarshal(m.Vaa)
				if err != nil {
					logger.Warn("received invalid VAA in SignedVAAWithQuorum message",
						zap.Error(err), zap.Any("message", m))
					continue
				}
				if v.EmitterChain == vaa.ChainIDPythNet {
					continue
				}
				rowKey := makeRowKey(v)
				signedVAAs[rowKey] = m.Vaa
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
				now := time.Now()
				networks := make([]*map[string]interface{}, 0, len(hb.Networks))
				for _, network := range hb.Networks {
					networks = append(networks, &map[string]interface{}{
						"id":              network.Id,
						"height":          strconv.FormatInt(network.Height, 10),
						"contractAddress": network.ContractAddress,
						"errorCount":      strconv.FormatUint(network.ErrorCount, 10),
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
