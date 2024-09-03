package historical_uptime

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	node_common "github.com/certusone/wormhole/node/pkg/common"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	eth_common "github.com/ethereum/go-ethereum/common"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/bigtable"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
)

type expectedObservation map[string]types.ObservationStatus

const (
	ProjectID    = "test-project"
	InstanceID   = "test-instance"
	EmulatorHost = "localhost:8086"
)

func processObservation(t *testing.T, observationBatches [][]node_common.MsgWithTimeStamp[gossipv1.SignedObservation], expectedObservations expectedObservation, expectedLastObservedAt time.Time) {
	database, err := bigtable.NewBigtableDB(context.TODO(), ProjectID, InstanceID, "", EmulatorHost, true)
	if err != nil {
		t.Errorf("failed to create Bigtable client: %v", err)
	}
	logger := ipfslog.Logger("historical-uptime").Desugar()
	defer database.Close()

	// Process observations by batch
	// Between batches flush to db is performed
	for _, obsBatch := range observationBatches {
		observationBatch := make([]*types.Observation, 0, len(observationBatches))

		// Convert SignedObservations to Observations
		for _, so := range obsBatch {
			o := CreateNewObservation(so.Msg.MessageId, so.Msg.Signature, so.Timestamp, so.Msg.Addr)
			observationBatch = append(observationBatch, o)
		}

		// Process the batch of observations
		err = ProcessObservationBatch(*database, logger, observationBatch)
		if err != nil {
			t.Errorf("failed to process observation batch: %v", err)
		}
	}

	dbObservations, err := database.GetObservationsByMessageID(context.TODO(), "1/chain1/1")
	if err != nil {
		t.Errorf("failed to get observations: %v", err)
	}

	if len(dbObservations) != len(expectedObservations) {
		t.Errorf("expected %d observations, got %d", len(expectedObservations), len(dbObservations))
		return
	}

	for i, o := range dbObservations {
		if dbObservations[i].Status != expectedObservations[o.GuardianAddr] {
			t.Errorf("expected observation by address %s to have status %x, got %x", o.GuardianAddr, expectedObservations[o.GuardianAddr], dbObservations[i].Status)
		}
	}

	message, err := database.GetMessage(context.TODO(), "1/chain1/1")
	if err != nil {
		t.Errorf("failed to get message: %v", err)
	}

	if !message.LastObservedAt.UTC().Equal(expectedLastObservedAt.UTC()) {
		t.Errorf("expected last observed at to be %s, got %s", expectedLastObservedAt.UTC(), message.LastObservedAt.UTC())
	}
}

func TestMain(m *testing.M) {
	// Set up the Bigtable emulator
	err := bigtable.SetupEmulator()
	if err != nil {
		fmt.Printf("Failed to set up the emulator: %v\n", err)
		os.Exit(1)
	}

	// Create a Bigtable client
	ctx := context.Background()
	db, err := bigtable.NewBigtableDB(ctx, ProjectID, InstanceID, "", EmulatorHost, true)
	if err != nil {
		fmt.Printf("Failed to create Bigtable client: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Run the tests
	exitCode := m.Run()
	err = bigtable.CleanUp()
	if err != nil {
		fmt.Printf("Failed to cleanup the Bigtable client: %v\n", err)
	}
	os.Exit(exitCode)
	m.Run()
}

// go test -v pkg/historical_uptime/process_observation_test.go pkg/historical_uptime/process_observation.go
func TestProcessObservation(t *testing.T) {
	expectedLastObservedAt := time.Now()
	fmt.Printf("expectedLastObservedAt: %s\n", expectedLastObservedAt)

	testCases := []struct {
		name string
		// Batches of observation batches
		input                  [][]node_common.MsgWithTimeStamp[gossipv1.SignedObservation]
		expectedObservations   expectedObservation
		expectedLastObservedAt time.Time
	}{
		{
			name: "normal test case",
			input: [][]node_common.MsgWithTimeStamp[gossipv1.SignedObservation]{{
				{
					Msg: &gossipv1.SignedObservation{
						MessageId: "1/chain1/1",
						Addr:      eth_common.HexToAddress("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").Bytes(),
						Signature: []byte("signature1"),
					},
					Timestamp: time.Now().Add(-time.Hour), // 1 hour ago
				},
				{
					Msg: &gossipv1.SignedObservation{
						MessageId: "1/chain1/1",
						Addr:      eth_common.HexToAddress("0x114De8460193bdf3A2fCf81f86a09765F4762fD1").Bytes(),
						Signature: []byte("signature2"),
					},
					Timestamp: expectedLastObservedAt,
				},
			}},
			expectedObservations: expectedObservation{
				"0xfF6CB952589BDE862c25Ef4392132fb9D4A42157": types.OnTime,
				"0x114De8460193bdf3A2fCf81f86a09765F4762fD1": types.OnTime,
			},

			expectedLastObservedAt: expectedLastObservedAt,
		},
		{
			name: "duplicated observations",
			input: [][]node_common.MsgWithTimeStamp[gossipv1.SignedObservation]{{
				{
					Msg: &gossipv1.SignedObservation{
						MessageId: "1/chain1/1",
						Addr:      eth_common.HexToAddress("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").Bytes(),
						Signature: []byte("signature1"),
					},
					Timestamp: time.Now().Add(-time.Hour), // 1 hour ago
				},
				{
					Msg: &gossipv1.SignedObservation{
						MessageId: "1/chain1/1",
						Addr:      eth_common.HexToAddress("0x114De8460193bdf3A2fCf81f86a09765F4762fD1").Bytes(),
						Signature: []byte("signature2"),
					},
					Timestamp: expectedLastObservedAt, // 1 hour ago
				},
				{
					Msg: &gossipv1.SignedObservation{
						MessageId: "1/chain1/1",
						Addr:      eth_common.HexToAddress("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").Bytes(),
						Signature: []byte("signature1"),
					},
					Timestamp: time.Now().Add(time.Hour * 1), // 1 hour later
				},
			}},
			expectedObservations: expectedObservation{
				"0xfF6CB952589BDE862c25Ef4392132fb9D4A42157": types.OnTime,
				"0x114De8460193bdf3A2fCf81f86a09765F4762fD1": types.OnTime,
			},
			expectedLastObservedAt: expectedLastObservedAt,
		},
		{
			name: "late observations",
			input: [][]node_common.MsgWithTimeStamp[gossipv1.SignedObservation]{{
				{
					Msg: &gossipv1.SignedObservation{
						MessageId: "1/chain1/1",
						Addr:      eth_common.HexToAddress("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").Bytes(),
						Signature: []byte("signature1"),
					},
					Timestamp: time.Now().Add(-time.Hour), // 1 hour ago
				},
				{
					Msg: &gossipv1.SignedObservation{
						MessageId: "1/chain1/1",
						Addr:      eth_common.HexToAddress("0x114De8460193bdf3A2fCf81f86a09765F4762fD1").Bytes(),
						Signature: []byte("signature2"),
					},
					Timestamp: expectedLastObservedAt,
				},
				{
					Msg: &gossipv1.SignedObservation{
						MessageId: "1/chain1/1",
						Addr:      eth_common.HexToAddress("0x107A0086b32d7A0977926A205131d8731D39cbEB").Bytes(),
						Signature: []byte("signature3"),
					},
					Timestamp: time.Now().Add(time.Hour * 31), // 31 hours after
				},
			}},
			expectedObservations: expectedObservation{
				"0xfF6CB952589BDE862c25Ef4392132fb9D4A42157": types.OnTime,
				"0x114De8460193bdf3A2fCf81f86a09765F4762fD1": types.OnTime,
				"0x107A0086b32d7A0977926A205131d8731D39cbEB": types.Late,
			},
			expectedLastObservedAt: expectedLastObservedAt,
		},
		// To test if flushing and processing post flushing works correctly
		{
			name: "flush and continue",
			input: [][]node_common.MsgWithTimeStamp[gossipv1.SignedObservation]{
				{
					{
						Msg: &gossipv1.SignedObservation{
							MessageId: "1/chain1/1",
							Addr:      eth_common.HexToAddress("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").Bytes(),
							Signature: []byte("signature1"),
						},
						Timestamp: time.Now().Add(-6 * time.Second),
					},
					{
						Msg: &gossipv1.SignedObservation{
							MessageId: "1/chain1/1",
							Addr:      eth_common.HexToAddress("0x114De8460193bdf3A2fCf81f86a09765F4762fD1").Bytes(),
							Signature: []byte("signature2"),
						},
						Timestamp: time.Now().Add(-5 * time.Second),
					},
				},
				{
					{
						Msg: &gossipv1.SignedObservation{
							MessageId: "1/chain1/1",
							Addr:      eth_common.HexToAddress("0x107A0086b32d7A0977926A205131d8731D39cbEB").Bytes(),
							Signature: []byte("signature3"),
						},
						Timestamp: time.Now(),
					},
				},
			},
			expectedObservations: expectedObservation{
				"0xfF6CB952589BDE862c25Ef4392132fb9D4A42157": types.OnTime,
				"0x114De8460193bdf3A2fCf81f86a09765F4762fD1": types.OnTime,
				"0x107A0086b32d7A0977926A205131d8731D39cbEB": types.OnTime,
			},
			expectedLastObservedAt: time.Now(),
		},
		// To test if processing post flushing works correctly and observations are deduped
		{
			name: "flush and continue - duplicated observations",
			input: [][]node_common.MsgWithTimeStamp[gossipv1.SignedObservation]{
				{
					{
						Msg: &gossipv1.SignedObservation{
							MessageId: "1/chain1/1",
							Addr:      eth_common.HexToAddress("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").Bytes(),
							Signature: []byte("signature1"),
						},
						Timestamp: expectedLastObservedAt.Add(-6 * time.Second),
					},
					{
						Msg: &gossipv1.SignedObservation{
							MessageId: "1/chain1/1",
							Addr:      eth_common.HexToAddress("0x114De8460193bdf3A2fCf81f86a09765F4762fD1").Bytes(),
							Signature: []byte("signature2"),
						},
						Timestamp: expectedLastObservedAt,
					},
				},
				{
					{
						Msg: &gossipv1.SignedObservation{
							MessageId: "1/chain1/1",
							Addr:      eth_common.HexToAddress("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").Bytes(),
							Signature: []byte("signature1"),
						},
						Timestamp: expectedLastObservedAt.Add(1 * time.Second),
					},
				},
			},
			expectedObservations: expectedObservation{
				"0xfF6CB952589BDE862c25Ef4392132fb9D4A42157": types.OnTime,
				"0x114De8460193bdf3A2fCf81f86a09765F4762fD1": types.OnTime,
			},
			expectedLastObservedAt: expectedLastObservedAt,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			processObservation(t, tc.input, tc.expectedObservations, tc.expectedLastObservedAt)
		})
	}
	// Convert SignedObservations to Observations
}
