package main

import (
	"context"
	"encoding/hex"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	tm "github.com/buger/goterm"
	node_common "github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"github.com/eiannone/keyboard"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
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
	loadTesting  = flag.Bool("loadTesting", false, "Should extra load testing analysis be performed)")
)

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc

	rpcUrl         string
	coreBridgeAddr string

	numGuardians int
	totalsRow    uint
	uniqueRow    uint

	// Guardian address to index map
	guardianIndexMap = map[string]int{}

	// Guardian index to address map
	guardianIndexToNameMap = map[int]string{}

	// The known token bridge emitters
	knownEmitters = map[string]bool{}

	lastTime = time.Now()
)

type heartbeat struct {
	bootTimestamp time.Time
	counter       string
	features      []string
	guardianAddr  string
	networks      []*gossipv1.Heartbeat_Network
	nodeName      string
	timestamp     time.Time
	version       string
}

type obsvRateRow struct {
	guardianIndex uint
	guardianName  string
	obsvCount     uint
	percents      [10]string
}

var currentObsvData map[uint]uint
var currentObsvTable map[uint]uint
var obsvRateRows []obsvRateRow

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
		rpcUrl = "https://rpc.ankr.com/eth"
		coreBridgeAddr = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B"
	} else if env == node_common.TestNet {
		guardians = common.TestnetGuardians
		knownEmitter = sdk.KnownTestnetEmitters
		rpcUrl = "https://rpc.ankr.com/eth_holesky"
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
	totalsRow = uint(numGuardians)
	obsvRateRows = make([]obsvRateRow, numGuardians)

	if *loadTesting {
		uniqueRow = uint(numGuardians + 1)
		guardianIndexToNameMap[int(totalsRow)] = "=== Totals ==="
		guardianIndexToNameMap[int(uniqueRow)] = "=== Unique ==="
	}

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

	initObsvTableData(true)

	// ctx := context.Background()

	// Node's main lifecycle context.
	rootCtx, rootCtxCancel = context.WithCancel(context.Background())
	defer rootCtxCancel()

	type GossipMsgType int16

	const (
		GSM_signedObservation GossipMsgType = iota
		GSM_tbObservation
		GSM_signedHeartbeat
		GSM_signedVaaWithQuorum
		GSM_signedObservationRequest
		GSM_signedChainGovernorConfig
		GSM_signedChainGovernorStatus
		GSM_maxTypeVal
	)

	// Outbound gossip message queue
	sendC := make(chan []byte)

	// Inbound observations
	obsvC := make(chan *node_common.MsgWithTimeStamp[gossipv1.SignedObservation], 20000)

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

	hbByGuardian := make(map[string]heartbeat, len(gs.Keys))

	// Keep a counter of all gossip message types by guardian.
	// Creating a 2 dimensional array:
	// First dimension = guardian id
	// Second dimension = gossip message type
	// Value = count
	if len(gs.Keys) != numGuardians {
		logger.Error("Invalid number of guardians.", zap.Int("found", len(gs.Keys)), zap.Int("expected", numGuardians))
		return
	}

	var gossipLock sync.Mutex
	// The extra row is for the totals
	numRows := numGuardians + 1
	if *loadTesting {
		// The extra row is for the count of unique keys.
		numRows += 1
	}
	gossipCounter := make([][]int, numRows)
	for idx := range gossipCounter {
		gossipCounter[idx] = make([]int, GSM_maxTypeVal)
	}

	activeTable := 1 // 0 = chains, 1 = guardians, 2 = message counts, 3 = obsv rate

	resetTerm(true)

	chainTable := table.NewWriter()
	chainTable.SetOutputMirror(os.Stdout)
	chainTable.AppendHeader(table.Row{"ID", "Chain", "Status", "Healthy", "Highest"})
	chainTable.SetStyle(table.StyleColoredDark)
	chainTable.SortBy([]table.SortBy{
		{Name: "ID", Mode: table.AscNumeric},
	})

	gossipMsgTable := table.NewWriter()
	gossipMsgTable.SetOutputMirror(os.Stdout)
	gossipMsgTable.AppendHeader(table.Row{"#", "Guardian", "Obsv", "TB_OBsv", "HB", "VAA", "Obsv_Req", "Chain_Gov_Cfg", "Chain_Gov_Status"})
	gossipMsgTable.SetStyle(table.StyleColoredDark)

	obsvRateTable := table.NewWriter()
	obsvRateTable.SetOutputMirror(os.Stdout)
	obsvRateTable.AppendHeader(table.Row{"#", "Guardian", "Obsv", "1%", "2%", "3%", "4%", "5%", "6%", "7%", "8%", "9%", "10%"})
	obsvRateTable.SetStyle(table.StyleColoredDark)

	guardianTable := table.NewWriter()
	guardianTable.SetOutputMirror(os.Stdout)
	guardianTable.AppendHeader(table.Row{"#", "Guardian", "Version", "Features", "Counter", "Boot", "Timestamp", "Address"})
	for idx, g := range gs.Keys {
		guardianTable.AppendRow(table.Row{idx, "", "", "", "", "", "", g})
	}
	guardianTable.SetStyle(table.StyleColoredDark)
	guardianTable.Render()
	prompt()

	// Keyboard handler
	if err := keyboard.Open(); err != nil {
		panic(err)
	}
	defer func() {
		keyboard.Close()
		resetTerm(true)
	}()
	go func() {
		for {
			char, key, err := keyboard.GetKey()
			if err != nil {
				logger.Fatal("error getting key", zap.Error(err))
			}
			wantsOut := false
			if key == keyboard.KeyCtrlC {
				wantsOut = true
			} else {
				switch string(char) {
				case "q":
					wantsOut = true
				case "c":
					activeTable = 0
					resetTerm(true)
					chainTable.Render()
					prompt()
				case "g":
					activeTable = 1
					resetTerm(true)
					guardianTable.Render()
					prompt()
				case "m":
					activeTable = 2
					resetTerm(true)
					gossipMsgTable.Render()
					prompt()
				case "o":
					activeTable = 3
					resetTerm(true)
					obsvRateTable.Render()
					prompt()
				}
			}
			if wantsOut {
				break
			}
		}
		rootCtxCancel()
	}()

	// Just count observations
	go func() {
		uniqueObs := map[string]struct{}{}
		for {
			select {
			case <-rootCtx.Done():
				return
			case o := <-obsvC:
				spl := strings.Split(o.Msg.MessageId, "/")
				emitter := strings.ToLower(spl[1])
				addr := "0x" + string(hex.EncodeToString(o.Msg.Addr))
				idx := guardianIndexMap[strings.ToLower(addr)]
				if knownEmitters[emitter] {
					gossipCounter[idx][GSM_tbObservation]++
					gossipCounter[totalsRow][GSM_tbObservation]++
				}
				if handleObsv(uint(idx)) {
					obsvRateTable.ResetRows()
					for i := 0; i < numGuardians; i++ {
						obsvRateTable.AppendRow(table.Row{i, obsvRateRows[int(i)].guardianName, obsvRateRows[int(i)].obsvCount, obsvRateRows[uint(i)].percents[0], obsvRateRows[uint(i)].percents[1], obsvRateRows[uint(i)].percents[2], obsvRateRows[uint(i)].percents[3], obsvRateRows[uint(i)].percents[4], obsvRateRows[uint(i)].percents[5], obsvRateRows[uint(i)].percents[6], obsvRateRows[uint(i)].percents[7], obsvRateRows[uint(i)].percents[8], obsvRateRows[uint(i)].percents[9]})
					}
				}
				gossipCounter[idx][GSM_signedObservation]++
				gossipCounter[totalsRow][GSM_signedObservation]++

				if *loadTesting {
					uniqueObs[hex.EncodeToString(o.Msg.Hash)] = struct{}{}
					gossipCounter[uniqueRow][GSM_signedObservation] = len(uniqueObs)
				}

				gossipLock.Lock()
				gossipMsgTable.ResetRows()
				for idx, r := range gossipCounter {
					gossipMsgTable.AppendRow(table.Row{idx, guardianIndexToNameMap[idx], r[0], r[1], r[2], r[3], r[4], r[5], r[6]})
				}
				gossipLock.Unlock()
			}
		}
	}()

	// Count observation requests
	// Note: without this, the whole program hangs on observation requests
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-obsvReqC:
				// There is no guardian address in the observation request
				// gossipCounter[idx][GSM_signedObservationRequest]++
				gossipCounter[totalsRow][GSM_signedObservationRequest]++
				gossipLock.Lock()
				gossipMsgTable.ResetRows()
				for idx, r := range gossipCounter {
					gossipMsgTable.AppendRow(table.Row{idx, guardianIndexToNameMap[idx], r[0], r[1], r[2], r[3], r[4], r[5], r[6]})
				}
				gossipLock.Unlock()
			}
		}
	}()

	// Just count signed VAAs
	go func() {
		uniqueVAAs := map[string]struct{}{}
		for {
			select {
			case <-rootCtx.Done():
				return
			case m := <-signedInC:
				// This only has VAABytes. It doesn't have the guardian address
				gossipCounter[totalsRow][GSM_signedVaaWithQuorum]++

				if *loadTesting {
					v, err := vaa.Unmarshal(m.Vaa)
					if err != nil {
						logger.Warn("received invalid VAA in SignedVAAWithQuorum message", zap.Error(err), zap.Any("message", m))
						os.Exit(0)
					} else {
						uniqueVAAs[v.HexDigest()] = struct{}{}
						gossipCounter[uniqueRow][GSM_signedVaaWithQuorum] = len(uniqueVAAs)
					}
				}

				gossipLock.Lock()
				gossipMsgTable.ResetRows()
				for idx, r := range gossipCounter {
					gossipMsgTable.AppendRow(table.Row{idx, guardianIndexToNameMap[idx], r[0], r[1], r[2], r[3], r[4], r[5], r[6]})
				}
				gossipLock.Unlock()
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
				hbByGuardian[id] = heartbeat{
					bootTimestamp: time.Unix(hb.BootTimestamp/1000000000, 0),
					counter:       strconv.FormatInt(hb.Counter, 10),
					features:      hb.Features,
					guardianAddr:  hb.GuardianAddr,
					networks:      hb.Networks,
					nodeName:      hb.NodeName,
					timestamp:     time.Unix(hb.Timestamp/1000000000, 0),
					version:       hb.Version,
				}
				chainTable.ResetRows()
				guardianTable.ResetRows()
				idx := guardianIndexMap[strings.ToLower(hb.GuardianAddr)]
				gossipCounter[idx][GSM_signedHeartbeat]++
				gossipCounter[totalsRow][GSM_signedHeartbeat]++
				chainIdsToHeartbeats := make(map[uint32][]*gossipv1.Heartbeat_Network)
				for idx, g := range gs.Keys {
					info, ok := hbByGuardian[g.String()]
					if ok {
						guardianTable.AppendRow(table.Row{idx, info.nodeName, info.version, strings.Join(info.features, ", "), info.counter, info.bootTimestamp, info.timestamp, g})
						for _, network := range info.networks {
							if _, ok := chainIdsToHeartbeats[network.Id]; !ok {
								chainIdsToHeartbeats[network.Id] = make([]*gossipv1.Heartbeat_Network, len(gs.Keys))
							}
							chainIdsToHeartbeats[network.Id] = append(chainIdsToHeartbeats[network.Id], network)
						}
					} else {
						guardianTable.AppendRow(table.Row{idx, "", "", "", "", "", "", g})
					}
				}
				for chainId, heartbeats := range chainIdsToHeartbeats {
					highest := int64(0)
					for _, heartbeat := range heartbeats {
						if heartbeat != nil && heartbeat.Height > highest {
							highest = heartbeat.Height
						}
					}
					healthyCount := 0
					for _, heartbeat := range heartbeats {
						if heartbeat != nil && heartbeat.Height != 0 && highest-heartbeat.Height <= 1000 {
							healthyCount++
						}
					}
					status := "green"
					if healthyCount < vaa.CalculateQuorum(len(gs.Keys)) {
						status = "red"
					} else if healthyCount < len(gs.Keys)-1 {
						status = "yellow"
					}
					chainTable.AppendRow(table.Row{chainId, vaa.ChainID(chainId), status, healthyCount, highest})
				}
				gossipLock.Lock()
				gossipMsgTable.ResetRows()
				for idx, r := range gossipCounter {
					gossipMsgTable.AppendRow(table.Row{idx, guardianIndexToNameMap[idx], r[0], r[1], r[2], r[3], r[4], r[5], r[6]})
				}
				gossipLock.Unlock()
				if activeTable == 0 {
					resetTerm(false)
					chainTable.Render()
				} else if activeTable == 1 {
					resetTerm(false)
					guardianTable.Render()
				} else if activeTable == 2 {
					resetTerm(false)
					gossipMsgTable.Render()
				} else {
					resetTerm(false)
					obsvRateTable.Render()
				}
				prompt()
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
				addr := "0x" + string(hex.EncodeToString(g.GuardianAddr))
				idx := guardianIndexMap[strings.ToLower(addr)]
				gossipCounter[idx][GSM_signedChainGovernorConfig]++
				gossipCounter[totalsRow][GSM_signedChainGovernorConfig]++
				gossipLock.Lock()
				gossipMsgTable.ResetRows()
				for idx, r := range gossipCounter {
					gossipMsgTable.AppendRow(table.Row{idx, guardianIndexToNameMap[idx], r[0], r[1], r[2], r[3], r[4], r[5], r[6]})
				}
				gossipLock.Unlock()
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
				addr := "0x" + string(hex.EncodeToString(g.GuardianAddr))
				idx := guardianIndexMap[strings.ToLower(addr)]
				gossipCounter[idx][GSM_signedChainGovernorStatus]++
				gossipCounter[totalsRow][GSM_signedChainGovernorStatus]++
				gossipLock.Lock()
				gossipMsgTable.ResetRows()
				for idx, r := range gossipCounter {
					gossipMsgTable.AppendRow(table.Row{idx, guardianIndexToNameMap[idx], r[0], r[1], r[2], r[3], r[4], r[5], r[6]})
				}
				gossipLock.Unlock()
			}
		}
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

func resetTerm(clear bool) {
	if clear {
		tm.Clear()
	}
	tm.MoveCursor(1, 1)
	tm.Flush()
}

func initObsvTableData(startup bool) {
	if startup {
		currentObsvData = make(map[uint]uint)
		currentObsvTable = make(map[uint]uint)
		for i := 0; i < numGuardians; i++ {
			obsvRateRows[i].guardianIndex = uint(i)
			obsvRateRows[i].guardianName = guardianIndexToNameMap[i]
			obsvRateRows[i].obsvCount = 0
			for j := 0; j < 10; j++ {
				obsvRateRows[i].percents[j] = " "
			}
		}
	}
	for i := 0; i < numGuardians+1; i++ {
		currentObsvData[uint(i)] = 0
		if startup {
			currentObsvTable[uint(i)] = 0
		}
	}
}

func handleObsv(idx uint) bool {
	needToRender := false
	now := time.Now()
	if now.Sub(lastTime) > time.Minute {
		lastTime = now
		for idx, r := range currentObsvData {
			currentObsvTable[idx] = r
		}
		for i := 0; i < numGuardians; i++ {
			obsvRateRows[i].obsvCount = currentObsvTable[uint(i)]
			if currentObsvTable[totalsRow] != 0 {
				pct := currentObsvTable[uint(i)] * 100 / currentObsvTable[totalsRow]
				for j := 0; j < 10; j++ {
					if pct >= uint(j+1) {
						obsvRateRows[i].percents[j] = "="
					} else {
						obsvRateRows[i].percents[j] = " "
					}
				}
			}
		}
		initObsvTableData(false)
		needToRender = true
	}
	currentObsvData[idx]++
	currentObsvData[totalsRow]++
	return needToRender
}

func prompt() {
	fmt.Print("[C]hains, [G]uardians, [M]essage Counts, [O]bsv Rate, [Q]uit: ")
}

func getGaugeValue(gauge prometheus.Gauge) (float64, error) {
	metric := &dto.Metric{}
	if err := gauge.Write(metric); err != nil {
		return 0, fmt.Errorf("failed to read metric value: %w", err)
	}
	return metric.GetGauge().GetValue(), nil
}
