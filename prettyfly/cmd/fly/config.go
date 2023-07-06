package main

const (
	MAINNET_ID        = "/wormhole/mainnet/2"
	MAINNET_BOOTSTRAP = "/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7,/dns4/wormhole-v2-mainnet-bootstrap.xlabs.xyz/udp/8999/quic/p2p/12D3KooWNQ9tVrcb64tw6bNs2CaNrUGPM7yRrKvBBheQ5yCyPHKC"

	TESTNET_ID        = "/wormhole/testnet/2/1"
	TESTNET_BOOTSTRAP = "/dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWAkB9ynDur1Jtoa97LBUp8RXdhzS5uHgAfdTquJbrbN7i"
)

type Config struct {
	P2PNetworkID       string
	P2PPort            uint
	P2PBootstrap       string
	NodeKeyPath        string
	LogLevel           string
	SignedVAATopicName string
	ChannelBuffer      int
}

func DefaultMainnetConfig() Config {
	return Config{
		P2PNetworkID:  MAINNET_ID,
		P2PBootstrap:  MAINNET_BOOTSTRAP,
		P2PPort:       8999,
		NodeKeyPath:   "/tmp/node.key",
		LogLevel:      "info",
		ChannelBuffer: 50,
	}
}

func DefaultTestnetConfig() Config {
	return Config{
		P2PNetworkID:  TESTNET_ID,
		P2PBootstrap:  TESTNET_BOOTSTRAP,
		P2PPort:       8999,
		NodeKeyPath:   "/tmp/node.key",
		LogLevel:      "info",
		ChannelBuffer: 50,
	}
}
