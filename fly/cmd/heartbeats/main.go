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
	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"github.com/eiannone/keyboard"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"
	"github.com/wormhole-foundation/wormhole/sdk"
	"github.com/wormhole-foundation/wormhole/sdk/vaa"

	"go.uber.org/zap"
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
var obsvRateRows [numGuardians]obsvRateRow

var knownEmitters map[string]bool // Holds the known token bridge emitters.

// Guardian address to index map
var guardianIndexMap = map[string]int{
	strings.ToLower("0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5"): 0,
	strings.ToLower("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157"): 1,
	strings.ToLower("0x114De8460193bdf3A2fCf81f86a09765F4762fD1"): 2,
	strings.ToLower("0x107A0086b32d7A0977926A205131d8731D39cbEB"): 3,
	strings.ToLower("0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2"): 4,
	strings.ToLower("0x11b39756C042441BE6D8650b69b54EbE715E2343"): 5,
	strings.ToLower("0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd"): 6,
	strings.ToLower("0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20"): 7,
	strings.ToLower("0x74a3bf913953D695260D88BC1aA25A4eeE363ef0"): 8,
	strings.ToLower("0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e"): 9,
	strings.ToLower("0xAF45Ced136b9D9e24903464AE889F5C8a723FC14"): 10,
	strings.ToLower("0xf93124b7c738843CBB89E864c862c38cddCccF95"): 11,
	strings.ToLower("0xD2CC37A4dc036a8D232b48f62cDD4731412f4890"): 12,
	strings.ToLower("0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811"): 13,
	strings.ToLower("0x71AA1BE1D36CaFE3867910F99C09e347899C19C3"): 14,
	strings.ToLower("0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf"): 15,
	strings.ToLower("0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8"): 16,
	strings.ToLower("0x5E1487F35515d02A92753504a8D75471b9f49EdB"): 17,
	strings.ToLower("0x6FbEBc898F403E4773E95feB15E80C9A99c8348d"): 18,
}

var guardianIndexToNameMap = map[int]string{
	0:  "Jump Crypto",
	1:  "Staked",
	2:  "Figment",
	3:  "ChainodeTech",
	4:  "Inotel",
	5:  "HashQuark",
	6:  "ChainLayer",
	7:  "xLabs",
	8:  "Forbole",
	9:  "Staking Fund",
	10: "MoonletWallet",
	11: "P2P Validator",
	12: "01node",
	13: "MCF-V2-MAINNET",
	14: "Everstake",
	15: "Chorus One",
	16: "syncnode",
	17: "Triton",
	18: "Staking Facilities",
	19: "Totals:",
}

var lastTime = time.Now()

const numGuardians = 19

func main() {

	// Fill in the known emitters
	knownEmitters = make(map[string]bool)
	for _, knownEmitter := range sdk.KnownEmitters {
		knownEmitters[strings.ToLower(knownEmitter.Emitter)] = true
	}
	initObsvTableData(true)
	// TODO: pass in config instead of hard-coding it
	p2pNetworkID = "/wormhole/mainnet/2"
	p2pBootstrap = "/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7,/dns4/wormhole-v2-mainnet-bootstrap.xlabs.xyz/udp/8999/quic/p2p/12D3KooWNQ9tVrcb64tw6bNs2CaNrUGPM7yRrKvBBheQ5yCyPHKC"
	p2pPort = 8999
	nodeKeyPath = "/tmp/node.key"
	logLevel = "warn"

	rpcUrl := flag.String("rpcUrl", "https://rpc.ankr.com/eth", "RPC URL for fetching current guardian set")
	coreBridgeAddr := flag.String("coreBridgeAddr", "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B", "Core bridge address for fetching guardian set")
	flag.Parse()
	if *rpcUrl == "" {
		fmt.Println("rpcUrl must be specified")
		os.Exit(1)
	}
	if *coreBridgeAddr == "" {
		fmt.Println("coreBridgeAddr must be specified")
		os.Exit(1)
	}

	lvl, err := ipfslog.LevelFromString(logLevel)
	if err != nil {
		fmt.Println("Invalid log level")
		os.Exit(1)
	}

	logger := ipfslog.Logger("wormhole-fly").Desugar()

	ipfslog.SetAllLoggers(lvl)

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
	obsvC := make(chan *gossipv1.SignedObservation, 1024)

	// Inbound observation requests
	obsvReqC := make(chan *gossipv1.ObservationRequest, 1024)

	// Inbound signed VAAs
	signedInC := make(chan *gossipv1.SignedVAAWithQuorum, 1024)

	// Heartbeat updates
	heartbeatC := make(chan *gossipv1.Heartbeat, 1024)

	// Guardian set state managed by processor
	gst := common.NewGuardianSetState(heartbeatC)

	// Governor cfg
	govConfigC := make(chan *gossipv1.SignedChainGovernorConfig, 1024)

	// Governor status
	govStatusC := make(chan *gossipv1.SignedChainGovernorStatus, 1024)
	// Bootstrap guardian set, otherwise heartbeats would be skipped
	idx, sgs, err := utils.FetchCurrentGuardianSet(*rpcUrl, *coreBridgeAddr)
	if err != nil {
		logger.Fatal("Failed to fetch guardian set", zap.Error(err))
	}
	logger.Info("guardian set", zap.Uint32("index", idx), zap.Any("gs", sgs))
	gs := common.GuardianSet{
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
	const totalsRow = numGuardians
	if len(gs.Keys) != numGuardians {
		logger.Error("Invalid number of guardians.", zap.Int("found", len(gs.Keys)), zap.Uint32("expected", numGuardians))
		return
	}

	var gossipLock sync.Mutex
	// The extra row is for the totals
	var gossipCounter = [numGuardians + 1][GSM_maxTypeVal]int{
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0}}

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
		for {
			select {
			case <-rootCtx.Done():
				return
			case o := <-obsvC:
				spl := strings.Split(o.MessageId, "/")
				emitter := strings.ToLower(spl[1])
				addr := "0x" + string(hex.EncodeToString(o.Addr))
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
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-signedInC:
				// This only has VAABytes. It doesn't have the guardian address
				gossipCounter[totalsRow][GSM_signedVaaWithQuorum]++
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
			pct := currentObsvTable[uint(i)] * 100 / currentObsvTable[numGuardians]
			for j := 0; j < 10; j++ {
				if pct >= uint(j+1) {
					obsvRateRows[i].percents[j] = "="
				} else {
					obsvRateRows[i].percents[j] = " "
				}
			}
		}
		initObsvTableData(false)
		needToRender = true
	}
	currentObsvData[idx]++
	currentObsvData[numGuardians]++
	return needToRender
}

func prompt() {
	fmt.Print("[C]hains, [G]uardians, [M]essage Counts, [O]bsv Rate, [Q]uit: ")
}
