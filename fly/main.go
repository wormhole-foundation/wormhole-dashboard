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
	"github.com/libp2p/go-libp2p-core/crypto"

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
	p2pNetworkID string
	p2pPort      uint
	p2pBootstrap string
	nodeKeyPath  string
	logLevel     string
)

func main() {
	// main
	p2pNetworkID = "/wormhole/mainnet/2"
	p2pBootstrap = "/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7"
	// devnet
	// p2pNetworkID = "/wormhole/dev"
	// p2pBootstrap = "/dns4/guardian-0.guardian/udp/8999/quic/p2p/12D3KooWL3XJ9EMCyZvmmGXL2LMiVBtrVa2BuESsJiXkSj7333Jw"
	p2pPort = 8999
	nodeKeyPath = "/tmp/node.key"
	logLevel = "warn"
	// common.SetRestrictiveUmask()

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
	gs := common.GuardianSet{
		Index: 2,
		Keys: []eth_common.Address{
			// mainnet
			eth_common.HexToAddress("0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5"), // Certus One
			eth_common.HexToAddress("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157"), // Staked
			eth_common.HexToAddress("0x114De8460193bdf3A2fCf81f86a09765F4762fD1"), // Figment
			eth_common.HexToAddress("0x107A0086b32d7A0977926A205131d8731D39cbEB"), // ChainodeTech
			eth_common.HexToAddress("0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2"), // Inotel
			eth_common.HexToAddress("0x11b39756C042441BE6D8650b69b54EbE715E2343"), // HashQuark
			eth_common.HexToAddress("0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd"), // ChainLayer
			eth_common.HexToAddress("0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20"), // xLabs
			eth_common.HexToAddress("0x74a3bf913953D695260D88BC1aA25A4eeE363ef0"), // Forbole
			eth_common.HexToAddress("0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e"), // Staking Fund
			eth_common.HexToAddress("0xAF45Ced136b9D9e24903464AE889F5C8a723FC14"), // MoonletWallet
			eth_common.HexToAddress("0xf93124b7c738843CBB89E864c862c38cddCccF95"), // P2P Validator
			eth_common.HexToAddress("0xD2CC37A4dc036a8D232b48f62cDD4731412f4890"), // 01node
			eth_common.HexToAddress("0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811"), // MCF-V2-MAINNET
			eth_common.HexToAddress("0x71AA1BE1D36CaFE3867910F99C09e347899C19C3"), // Everstake
			eth_common.HexToAddress("0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf"), // Chorus One
			eth_common.HexToAddress("0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8"), // syncnode
			eth_common.HexToAddress("0x5E1487F35515d02A92753504a8D75471b9f49EdB"), // Triton
			eth_common.HexToAddress("0x6FbEBc898F403E4773E95feB15E80C9A99c8348d"), // Staking Facilities
			// devnet
			// eth_common.HexToAddress("0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe"),
		},
	}
	// TODO: fetch this and probably figure out how to update it live
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
