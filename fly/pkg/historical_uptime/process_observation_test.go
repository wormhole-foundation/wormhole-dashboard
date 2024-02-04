package historical_uptime

import (
	node_common "github.com/certusone/wormhole/node/pkg/common"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	eth_common "github.com/ethereum/go-ethereum/common"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/db"
	"go.uber.org/zap"
	"testing"
	"time"
)

type expectedObservation struct {
	Addr   string
	Status db.ObservationStatus
}

func processObservation(t *testing.T, observations []node_common.MsgWithTimeStamp[gossipv1.SignedObservation], expectedObservations []expectedObservation, expectedLastObservedAt time.Time) {
	database := db.OpenDb(zap.NewNop(), nil)
	logger := ipfslog.Logger("historical-uptime").Desugar()
	defer database.Close()

	// Process each observation
	for _, o := range observations {
		ProcessObservation(*database, logger, o)
	}

	message, err := database.GetMessage("1/chain1/1")
	if err != nil {
		t.Errorf("failed to get message: %v", err)
	}

	if len(message.Observations) != len(expectedObservations) {
		t.Errorf("expected %d observations, got %d", len(expectedObservations), len(message.Observations))
		return
	}

	for i, o := range message.Observations {
		if o.GuardianAddr != expectedObservations[i].Addr {
			t.Errorf("expected observation %d to have address %s, got %s", i, expectedObservations[i], o.GuardianAddr)
		}

		if o.Status != expectedObservations[i].Status {
			t.Errorf("expected observation %d to have status %s, got %s", i, expectedObservations[i].Status.String(), o.Status.String())
		}
	}

	if !message.LastObservedAt.Equal(expectedLastObservedAt) {
		t.Errorf("expected last observed at to be %s, got %s", expectedLastObservedAt, message.LastObservedAt)
	}
}

func TestProcessObservation(t *testing.T) {
	expectedLastObservedAt := time.Now()

	testCases := []struct {
		name                   string
		input                  []node_common.MsgWithTimeStamp[gossipv1.SignedObservation]
		expectedObservations   []expectedObservation
		expectedLastObservedAt time.Time
	}{
		{
			name: "normal test case",
			input: []node_common.MsgWithTimeStamp[gossipv1.SignedObservation]{
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
			},
			expectedObservations: []expectedObservation{
				{
					Addr:   "0xfF6CB952589BDE862c25Ef4392132fb9D4A42157",
					Status: db.OnTime,
				},
				{
					Addr:   "0x114De8460193bdf3A2fCf81f86a09765F4762fD1",
					Status: db.OnTime,
				},
			},
			expectedLastObservedAt: expectedLastObservedAt,
		},
		{
			name: "duplicated observations",
			input: []node_common.MsgWithTimeStamp[gossipv1.SignedObservation]{
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
			},
			expectedObservations: []expectedObservation{
				{
					Addr:   "0xfF6CB952589BDE862c25Ef4392132fb9D4A42157",
					Status: db.OnTime,
				},
				{
					Addr:   "0x114De8460193bdf3A2fCf81f86a09765F4762fD1",
					Status: db.OnTime,
				},
			},
			expectedLastObservedAt: expectedLastObservedAt,
		},
		{
			name: "late observations",
			input: []node_common.MsgWithTimeStamp[gossipv1.SignedObservation]{
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
			},
			expectedObservations: []expectedObservation{
				{
					Addr:   "0xfF6CB952589BDE862c25Ef4392132fb9D4A42157",
					Status: db.OnTime,
				},
				{
					Addr:   "0x114De8460193bdf3A2fCf81f86a09765F4762fD1",
					Status: db.OnTime,
				},
				{
					Addr:   "0x107A0086b32d7A0977926A205131d8731D39cbEB",
					Status: db.Late,
				},
			},
			expectedLastObservedAt: expectedLastObservedAt,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			processObservation(t, tc.input, tc.expectedObservations, tc.expectedLastObservedAt)
		})
	}
}
