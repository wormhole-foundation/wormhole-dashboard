// This program listens to the gossip network and monitors the receipt of Pythnet VAAs to see how the specified guardian performs relative to the others.
// The guardian to be monitored in specified by setting ourGuardianIndex to the index of the guardian in the guardian set (See guardian set creation below.).
//
// Run the program as follows:
// $ export GOLOG_FILE=fly.log; rm -f fly.log; go run trackPyth.go
// $ tail -f fly.log | grep data

package main

import (
	"context"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	eth_common "github.com/ethereum/go-ethereum/common"
	eth_crypto "github.com/ethereum/go-ethereum/crypto"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/libp2p/go-libp2p-core/crypto"
	"github.com/mr-tron/base58"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"
	"github.com/wormhole-foundation/wormhole/sdk/vaa"

	"go.uber.org/zap"
)

type (
	msgEntry struct {
		firstObservation time.Time
		receivedByUs     time.Time
		seenByUs         bool
		weWereFirst      bool
	}

	msgMapType       map[string]*msgEntry
	signedVaaMapType map[string]time.Time
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

	msgMapLock   sync.Mutex
	msgMap       msgMapType
	signedVaaMap signedVaaMapType

	ourGuardianAddr    string
	ourGuardianVersion string

	// Note: If you add anything here, be sure to update handleHeartbeat.
	weWon            uint64
	weLost           uint64
	weMissed         uint64
	allPythnetVaas   uint64
	noObservations   uint64
	signedByUs       uint64
	totalTimeSum     int64
	totalTimeSamples int64
	ourTimeSum       int64
	ourTimeSamples   int64
)

// ourGuardianIndex specifies the guardian index that we want to monitor.
const ourGuardianIndex = 0 // Certus One

func main() {
	// main
	p2pNetworkID = "/wormhole/mainnet/2"
	p2pBootstrap = "/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7"
	// devnet
	// p2pNetworkID = "/wormhole/dev"
	// p2pBootstrap = "/dns4/guardian-0.guardian/udp/8999/quic/p2p/12D3KooWL3XJ9EMCyZvmmGXL2LMiVBtrVa2BuESsJiXkSj7333Jw"
	p2pPort = 8999
	nodeKeyPath = "/tmp/node.key"
	logLevel = "info"
	// common.SetRestrictiveUmask()

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

	msgMap = make(msgMapType)
	signedVaaMap = make(signedVaaMapType)
	ourGuardianAddr = gs.Keys[ourGuardianIndex].String()

	// Ignore observations
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case m := <-obsvC:
				handleObservation(logger, gs, m)
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

	// Don't ignore signed VAAs
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case m := <-signedInC:
				handleSignedVAAWithQuorum(logger, gs, m)
			}
		}
	}()

	// Ignore heartbeats
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case m := <-heartbeatC:
				if m.GetGuardianAddr() == ourGuardianAddr {
					handleHeartbeat(logger, m)
				}
			}
		}
	}()

	// Ignore govConfigs
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-govConfigC:
			}
		}
	}()

	// Ignore govStatus
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-govStatusC:
			}
		}
	}()

	// Clean up our VAA map.
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-ticker.C:
				cleanUpMap(logger)
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
	logger.Info("root context cancelled, sleeping...")
	time.Sleep(2 * time.Second)
	logger.Info("done sleeping, exiting")
	// TODO: wait for things to shut down gracefully

}

func handleSignedVAAWithQuorum(logger *zap.Logger, gs common.GuardianSet, m *gossipv1.SignedVAAWithQuorum) {
	v, err := vaa.Unmarshal(m.Vaa)
	if err != nil {
		logger.Warn("received invalid VAA in SignedVAAWithQuorum message",
			zap.Error(err), zap.Any("message", m))
		return
	}

	// Calculate digest for logging
	digest := v.SigningMsg()
	hash := hex.EncodeToString(digest.Bytes())

	// Check if guardianSet doesn't have any keys
	if len(gs.Keys) == 0 {
		logger.Warn("dropping SignedVAAWithQuorum message since we have a guardian set without keys",
			zap.String("digest", hash),
			zap.Any("message", m),
		)
		return
	}

	if err := v.Verify(gs.Keys); err != nil {
		logger.Warn("dropping SignedVAAWithQuorum message because it failed verification: " + err.Error())
		return
	}

	msgId := v.MessageID()

	if v.EmitterChain != vaa.ChainIDPythNet {
		logger.Debug("ignoring non-pythnet signed vaa", zap.String("msgId", msgId))
		return
	}

	msgMapLock.Lock()
	defer msgMapLock.Unlock()

	if _, exists := signedVaaMap[msgId]; exists {
		return
	}

	logger.Debug("received a pythnet signed vaa", zap.String("msgId", msgId), zap.Uint32("gsIdx", v.GuardianSetIndex), zap.Int("numSigs", len(v.Signatures)))
	allPythnetVaas += 1

	now := time.Now()
	signedVaaMap[msgId] = now

	weSigned := false
	for _, sig := range v.Signatures {
		if sig.Index == ourGuardianIndex {
			weSigned = true
			logger.Debug("pythnet vaa signed by this guardian", zap.String("msgId", msgId), zap.Uint8("sigIdx", sig.Index))
		}
	}

	me, exists := msgMap[msgId]
	if exists {
		totalTime := now.Sub(me.firstObservation)
		totalTimeSum += totalTime.Microseconds()
		totalTimeSamples += 1

		if weSigned {
			signedByUs += 1
		}

		if me.seenByUs {
			ourTimeSamples += 1
			if !me.weWereFirst {
				weLost += 1
				ourTime := me.receivedByUs.Sub(me.firstObservation)
				ourTimeSum += ourTime.Microseconds()
				logger.Debug("TIME, We lost", zap.String("msgId", msgId), zap.Stringer("ourTime", ourTime), zap.Stringer("totalTime", totalTime))
			} else {
				weWon += 1
				logger.Debug("TIME, We won", zap.String("msgId", msgId), zap.Stringer("totalTime", totalTime))
			}
		} else {
			weMissed += 1
			logger.Debug("TIME, We didn't see it", zap.String("msgId", msgId), zap.Stringer("totalTime", totalTime))
		}
	} else {
		noObservations += 1
		logger.Debug("Received a signed VAA without any observations!", zap.String("msgId", msgId))
	}

	if allPythnetVaas%100 == 0 {
		averageTimeMs := int64(0)
		if totalTimeSamples > 0 {
			averageTimeMs = totalTimeSum / totalTimeSamples
		}

		ourAverageMics := int64(0)
		if ourTimeSamples > 0 {
			ourAverageMics = ourTimeSum / ourTimeSamples
		}

		logger.Info("data", zap.Uint64("allPythnetVaas", allPythnetVaas), zap.Uint64("noObs", noObservations), zap.Uint64("signedByUs", signedByUs),
			zap.Uint64("weWon", weWon), zap.Uint64("weLost", weLost), zap.Uint64("weMissed", weMissed),
			zap.Int64("averageTimeMics", averageTimeMs), zap.Int64("ourAverageMics", ourAverageMics),
			zap.String("version", ourGuardianVersion))
	}
}

func handleObservation(logger *zap.Logger, gs common.GuardianSet, m *gossipv1.SignedObservation) {
	hash := hex.EncodeToString(m.Hash)

	// Verify the Guardian's signature. This verifies that m.Signature matches m.Hash and recovers
	// the public key that was used to sign the payload.
	pk, err := eth_crypto.Ecrecover(m.Hash, m.Signature)
	if err != nil {
		logger.Warn("failed to verify signature on observation",
			zap.String("digest", hash),
			zap.String("signature", hex.EncodeToString(m.Signature)),
			zap.String("addr", hex.EncodeToString(m.Addr)),
			zap.Error(err))
		return
	}

	// Verify that m.Addr matches the public key that signed m.Hash.
	their_addr := eth_common.BytesToAddress(m.Addr)
	signer_pk := eth_common.BytesToAddress(eth_crypto.Keccak256(pk[1:])[12:])

	if their_addr != signer_pk {
		logger.Warn("invalid observation - address does not match pubkey",
			zap.String("digest", hash),
			zap.String("signature", hex.EncodeToString(m.Signature)),
			zap.String("addr", hex.EncodeToString(m.Addr)),
			zap.String("pk", signer_pk.Hex()))
		return
	}

	// Verify that m.Addr is included in the guardian set. If it's not, drop the message. In case it's us
	// who have the outdated guardian set, we'll just wait for the message to be retransmitted eventually.
	guardianIndex, ok := gs.KeyIndex(their_addr)
	if !ok {
		logger.Warn("received observation by unknown guardian - is our guardian set outdated?",
			zap.String("digest", hash),
			zap.String("their_addr", their_addr.Hex()),
			zap.Uint32("index", gs.Index),
			zap.Any("keys", gs.KeysAsHexStrings()),
		)
		return
	}

	// Hooray! Now, we have verified all fields on SignedObservation and know that it includes
	// a valid signature by an active guardian. We still don't fully trust them, as they may be
	// byzantine, but now we know who we're dealing with.

	logger.Debug("received observation",
		zap.String("digest", hash),
		zap.String("signature", hex.EncodeToString(m.Signature)),
		zap.String("addr", hex.EncodeToString(m.Addr)),
		zap.String("txhash", hex.EncodeToString(m.TxHash)),
		zap.String("txhash_b58", base58.Encode(m.TxHash)),
		zap.String("message_id", m.MessageId),
		zap.Int("guardianIndex", guardianIndex),
	)

	if strings.Index(m.MessageId, `26/`) != 0 {
		logger.Debug("ignoring non-pythnet vaa", zap.String("msgId", m.MessageId), zap.Int("guardianIndex", guardianIndex))
		return
	}

	logger.Debug("Received pythnet observation", zap.String("msgId", m.MessageId), zap.Int("guardianIndex", guardianIndex))

	msgMapLock.Lock()
	defer msgMapLock.Unlock()

	if _, exists := signedVaaMap[m.MessageId]; exists {
		return
	}

	now := time.Now()
	me, exists := msgMap[m.MessageId]
	if !exists {
		me = &msgEntry{firstObservation: now}
		msgMap[m.MessageId] = me

		if guardianIndex == ourGuardianIndex {
			logger.Debug("We won", zap.String("msgId", m.MessageId))
			me.weWereFirst = true
		} else {
			logger.Debug("We lost", zap.String("msgId", m.MessageId))
		}
	}

	if guardianIndex == ourGuardianIndex {
		logger.Debug("Seen by us", zap.String("msgId", m.MessageId))
		me.receivedByUs = now
		me.seenByUs = true
	}
}

func cleanUpMap(logger *zap.Logger) {
	msgMapLock.Lock()
	defer msgMapLock.Unlock()

	for key, t := range signedVaaMap {
		if time.Since(t) > 5*time.Minute {
			delete(signedVaaMap, key)
		}
	}
}

func handleHeartbeat(logger *zap.Logger, m *gossipv1.Heartbeat) {
	msgMapLock.Lock()
	defer msgMapLock.Unlock()

	if ourGuardianVersion != m.GetVersion() {
		if ourGuardianVersion != "" {
			logger.Info("Guardian version has changed, resetting all counts", zap.String("oldVersion", ourGuardianVersion), zap.String("newVersion", m.GetVersion()))

			weWon = 0
			weLost = 0
			weMissed = 0
			allPythnetVaas = 0
			noObservations = 0
			signedByUs = 0
			totalTimeSum = 0
			totalTimeSamples = 0
			ourTimeSum = 0
			ourTimeSamples = 0
		}

		ourGuardianVersion = m.GetVersion()
	}
}
