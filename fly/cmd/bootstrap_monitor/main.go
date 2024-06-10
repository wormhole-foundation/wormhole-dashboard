package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	promremotew "github.com/certusone/wormhole/node/pkg/telemetry/prom_remote_write"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/joho/godotenv"
	pubsub "github.com/libp2p/go-libp2p-pubsub"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.uber.org/zap"
	"google.golang.org/protobuf/proto"
)

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc
	hbReceived    bool
	// The following are from the .env file:
	p2pNetworkID  string
	p2pPort       uint
	nodeKeyPath   string
	logLevel      string
	promRemoteURL string
)

var (
	bootstrapPeerStatus = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "bootstrap_peer_status",
			Help: "Bootstrap peer status (1 = received heartbeat, 0 = no heartbeat)",
		}, []string{"bootstrap_peer"})
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
	promRemoteURL = verifyEnvVar("PROM_REMOTE_URL")
}

func verifyEnvVar(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("%s must be specified", key)
	}
	return value
}

func RunPrometheusScraper(ctx context.Context, logger *zap.Logger, info promremotew.PromTelemetryInfo) error {
	promLogger := logger.With(zap.String("component", "prometheus_scraper"))
	errC := make(chan error)
	common.StartRunnable(ctx, errC, false, "prometheus_scraper", func(ctx context.Context) error {
		t := time.NewTicker(15 * time.Second)

		for {
			select {
			case <-ctx.Done():
				return nil
			case <-t.C:
				err := promremotew.ScrapeAndSendLocalMetrics(ctx, info, promLogger)
				if err != nil {
					promLogger.Error("ScrapeAndSendLocalMetrics error", zap.Error(err))
					// Don't want to return here, as we want to keep trying.
					// We only want to return if the context is done.
				}
			}
		}
	})
	return nil
}

func main() {
	loadEnvVars()
	p2pNetworkID = p2p.MainnetNetworkId
	p2pBootstraps := strings.Split(p2p.MainnetBootstrapPeers, `,`)
	level, err := ipfslog.LevelFromString(logLevel)
	if err != nil {
		fmt.Println("Invalid log level")
		os.Exit(1)
	}

	logger := ipfslog.Logger("bootstrap-monitor").Desugar()

	ipfslog.SetAllLoggers(level)

	// Load p2p private key
	var priv crypto.PrivKey
	priv, err = common.GetOrCreateNodeKey(logger, nodeKeyPath)
	if err != nil {
		logger.Fatal("Failed to load node key", zap.Error(err))
	}

	// Main lifecycle context.
	rootCtx, rootCtxCancel = context.WithCancel(context.Background())
	defer rootCtxCancel()

	// Prometheus stuff
	// Start the Prometheus scraper
	usingPromRemoteWrite := promRemoteURL != ""
	if usingPromRemoteWrite {
		var info promremotew.PromTelemetryInfo
		info.PromRemoteURL = promRemoteURL
		info.Labels = map[string]string{
			"network": p2pNetworkID,
			"product": "bootstrap_monitor",
		}

		err := RunPrometheusScraper(rootCtx, logger, info)
		if err != nil {
			logger.Fatal("Failed to start prometheus scraper", zap.Error(err))
		}
	}
	// End Prometheus stuff

	// This starts an infinite loop that will run the p2p heartbeat checks every 15 minutes
	for {
		for _, bootstrap := range p2pBootstraps {
			localContext, localCancel := context.WithCancel(rootCtx)
			defer localCancel()
			logger.Info("Starting p2p", zap.String("bootstrap", bootstrap))
			hbReceived = false
			bootstrapPeer := bootstrap
			components := p2p.DefaultComponents()
			components.Port = p2pPort

			host, err := p2p.NewHost(logger, localContext, p2pNetworkID, bootstrapPeer, components, priv)
			if err != nil {
				bootstrapPeerStatus.WithLabelValues(bootstrapPeer).Set(0)
				logger.Error("failed to create host", zap.String("bootstrapPeer", bootstrapPeer), zap.Error(err))
				continue
			}

			ps, err := pubsub.NewGossipSub(localContext, host)
			if err != nil {
				bootstrapPeerStatus.WithLabelValues(bootstrapPeer).Set(0)
				logger.Error("failed to create subscription", zap.String("bootstrapPeer", bootstrapPeer), zap.Error(err))
				continue
			}

			topic := fmt.Sprintf("%s/%s", p2pNetworkID, "broadcast")
			topicHandle, err := ps.Join(topic)
			if err != nil {
				bootstrapPeerStatus.WithLabelValues(bootstrapPeer).Set(0)
				logger.Error("failed to join topic", zap.String("bootstrapPeer", bootstrapPeer), zap.Error(err))
				continue
			}
			sub, err := topicHandle.Subscribe()
			if err != nil {
				bootstrapPeerStatus.WithLabelValues(bootstrapPeer).Set(0)
				logger.Error("failed to subscribe to topic", zap.String("bootstrapPeer", bootstrapPeer), zap.Error(err))
				continue
			}

			go func() {
				for {
					envelope, err := sub.Next(localContext)
					if err != nil {
						logger.Error("failed to receive pubsub message", zap.Error(err))
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
					// Only look at heartbeats
					if msg.GetSignedHeartbeat() == nil {
						continue
					}
					logger.Debug("received Heartbeat")
					hbReceived = true
					break
				}
				// Start shutdown
				logger.Debug("Shutting down...")
				sub.Cancel()
				if err := topicHandle.Close(); err != nil {
					logger.Error("Error closing the broadcast topic", zap.Error(err))
				}
				if err := host.Close(); err != nil {
					logger.Error("Error closing the host", zap.Error(err))
				}
				// End shutdown
			}()

			// Max time to wait for a heartbeat is 15 seconds
			for i := 0; i < 15; i++ {
				time.Sleep(1 * time.Second)
				if hbReceived {
					break
				}
			}

			if hbReceived {
				logger.Info("***** Heartbeat received ***** for", zap.String("bootstrap peer", bootstrapPeer))
				bootstrapPeerStatus.WithLabelValues(bootstrapPeer).Set(1)
			} else {
				logger.Warn("******** ALERT ********** No heartbeat received for", zap.String("bootstrap peer", bootstrapPeer))
				bootstrapPeerStatus.WithLabelValues(bootstrapPeer).Set(0)
			}

			// Cancel local context to break out of sub.Next()
			localCancel()
			logger.Info("local context cancelled")

			// This is the udp port timeout
			time.Sleep(40 * time.Second)
		}
		logger.Info("Sleeping for 15 minutes")
		time.Sleep(15 * time.Minute)
	}

	rootCtxCancel()
	logger.Info("root context cancelled, exiting...")
}
