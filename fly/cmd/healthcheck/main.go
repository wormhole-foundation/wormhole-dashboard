package main

import (
	"bytes"
	"context"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"

	ipfslog "github.com/ipfs/go-log/v2"
	pubsub "github.com/libp2p/go-libp2p-pubsub"
	"github.com/libp2p/go-libp2p/core/peer"
	"go.uber.org/zap"
	"google.golang.org/protobuf/proto"
)

var (
	pubKey       string
	url          string
	timeout      time.Duration
	p2pNetworkID string
	p2pBootstrap string
	p2pPort      uint
	nodeKeyPath  string
	logLevel     string
)

func main() {

	flag.StringVar(&pubKey, "pubKey", "", "A guardian public key")
	flag.StringVar(&url, "url", "", "The public web url of a guardian")
	flag.DurationVar(&timeout, "timeout", 15*time.Second, "The duration to wait for a heartbeat and observations")
	flag.StringVar(&p2pNetworkID, "network", p2p.MainnetNetworkId, "P2P network identifier")
	flag.StringVar(&p2pBootstrap, "bootstrap", p2p.MainnetBootstrapPeers, "The list of bootstrap peers (comma-separate) to connect to for gossip network tests. This can be useful to test a particular bootstrap peer.")
	flag.UintVar(&p2pPort, "port", p2p.DefaultPort, "P2P UDP listener port")
	flag.StringVar(&nodeKeyPath, "nodeKeyPath", "/tmp/health_check.key", "A libp2p node key. Will be created if it does not exist.")
	flag.StringVar(&logLevel, "logLevel", "error", "The logging level. Valid values are error, warn, info, and debug.")
	flag.Parse()

	lvl, err := ipfslog.LevelFromString(logLevel)
	if err != nil {
		fmt.Println("Invalid log level")
		os.Exit(1)
	}
	logger := ipfslog.Logger("health-check").Desugar()
	ipfslog.SetAllLoggers(lvl)
	rootCtx, rootCtxCancel := context.WithCancel(context.Background())
	defer rootCtxCancel()

	if pubKey != "" {
		priv, err := common.GetOrCreateNodeKey(logger, nodeKeyPath)
		if err != nil {
			logger.Fatal("Failed to load node key", zap.Error(err))
		}
		guardianPubKey, err := hex.DecodeString(strings.TrimPrefix(pubKey, "0x"))
		if err != nil {
			logger.Fatal("Failed to decode guardian public key", zap.Error(err))
		}
		logger.Info("Connecting to bootstrap peer(s)", zap.String("p2pBootstrap", p2pBootstrap))
		localContext, localCancel := context.WithCancel(rootCtx)
		defer localCancel()
		hbReceived := false
		var addrInfo peer.AddrInfo
		observationsReceived := 0
		components := p2p.DefaultComponents()
		components.Port = p2pPort
		host, err := p2p.NewHost(logger, localContext, p2pNetworkID, p2pBootstrap, components, priv)
		if err != nil {
			logger.Fatal("failed to create host", zap.String("p2pBootstrap", p2pBootstrap), zap.Error(err))
		}

		ps, err := pubsub.NewGossipSub(localContext, host)
		if err != nil {
			logger.Fatal("failed to create subscription", zap.String("p2pBootstrap", p2pBootstrap), zap.Error(err))
		}

		topic := fmt.Sprintf("%s/%s", p2pNetworkID, "broadcast")
		topicHandle, err := ps.Join(topic)
		if err != nil {
			logger.Fatal("failed to join topic", zap.String("p2pBootstrap", p2pBootstrap), zap.Error(err))
		}
		sub, err := topicHandle.Subscribe()
		if err != nil {
			logger.Fatal("failed to subscribe to topic", zap.String("p2pBootstrap", p2pBootstrap), zap.Error(err))
		}
		go func() {
			for {
				envelope, err := sub.Next(localContext)
				if err != nil {
					logger.Info("failed to receive pubsub message", zap.Error(err))
					break
				}
				var msg gossipv1.GossipMessage
				err = proto.Unmarshal(envelope.Data, &msg)
				if err != nil {
					logger.Info("received invalid message",
						zap.Binary("data", envelope.Data),
						zap.String("from", envelope.GetFrom().String()))
					continue
				}
				switch m := msg.Message.(type) {
				case *gossipv1.GossipMessage_SignedHeartbeat:
					logger.Debug("received heartbeat")
					if bytes.Equal(m.SignedHeartbeat.GuardianAddr, guardianPubKey) {
						addrInfo = host.Peerstore().PeerInfo(envelope.GetFrom())
						if !hbReceived {
							hbReceived = true
						}
					}
				case *gossipv1.GossipMessage_SignedObservation:
					logger.Debug("received observation")
					if bytes.Equal(m.SignedObservation.Addr, guardianPubKey) {
						observationsReceived++
					}
				}
			}
			// Start shutdown
			logger.Debug("Shutting down...")
			sub.Cancel()
			if err := topicHandle.Close(); err != nil {
				logger.Info("Error closing the broadcast topic", zap.Error(err))
			}
			if err := host.Close(); err != nil {
				logger.Info("Error closing the host", zap.Error(err))
			}
			// End shutdown
		}()
		time.Sleep(timeout)
		// Cancel local context to break out of sub.Next()
		localCancel()
		logger.Info("local context cancelled")

		if hbReceived {
			fmt.Println("✅ guardian heartbeat received", addrInfo.String())
		} else {
			fmt.Println("❌ NO HEARTBEAT RECEIVED")
		}
		if observationsReceived > 0 {
			fmt.Printf("✅ %d observations received\n", observationsReceived)
		} else {
			fmt.Println("❌ NO OBSERVATIONS RECEIVED")
		}
	} else {
		fmt.Println("ℹ️  --pubKey not defined, skipping gossip checks")
	}

	if url != "" {
		if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
			logger.Fatal("url must start with http:// or https://")
		}
		hbSuccess := false
		url = strings.TrimSuffix(url, "/")
		logger.Info("Testing http services")
		res, err := http.Get(fmt.Sprintf("%s/v1/heartbeats", url))
		if err != nil {
			logger.Info("error fetching heartbeats", zap.Error(err))
		} else {
			if res.StatusCode == 200 {
				body, err := io.ReadAll(res.Body)
				if err != nil {
					logger.Info("error reading body", zap.Error(err))
				} else {
					if string(body[:10]) == "{\"entries\"" {
						hbSuccess = true
					}
				}
			} else {
				logger.Info("bad status fetching heartbeats", zap.Int("status", res.StatusCode))
			}
		}
		if hbSuccess {
			fmt.Println("✅ /v1/heartbeats")
		} else {
			fmt.Println("❌ /v1/heartbeats")
		}
	} else {
		fmt.Println("ℹ️  --url not defined, skipping web checks")
	}

	rootCtxCancel()
	logger.Info("root context cancelled, exiting...")
}
