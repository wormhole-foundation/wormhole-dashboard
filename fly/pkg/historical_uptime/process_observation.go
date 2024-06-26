package historical_uptime

import (
	"context"
	"encoding/hex"
	"fmt"
	"time"

	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/bigtable"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
	"go.uber.org/zap"
)

// createNewObservation creates a new observation from the given observation
func createNewObservation(timestamp time.Time, addr []byte, o *gossipv1.Observation) types.Observation {
	ga := eth_common.BytesToAddress(addr).String()
	return types.Observation{
		MessageID:    types.MessageID(o.MessageId),
		GuardianAddr: ga,
		Signature:    hex.EncodeToString(o.Signature),
		ObservedAt:   timestamp,
		Status:       types.OnTime,
	}
}

// checkObservationTime checks if the observation is late
func checkObservationTime(message *types.Message, newObservation types.Observation) types.Observation {
	nextExpiry := message.LastObservedAt.Add(common.ExpiryDuration)
	if newObservation.ObservedAt.After(nextExpiry) {
		newObservation.Status = types.Late
	}
	return newObservation
}

// ProcessObservation processes an observation and updates the database accordingly.
// If the message does not exist in the database, it will be created.
// If the message exists, the observation will be appended to the message.
// If the observation is late, observation status will be set to Late.
func ProcessObservation(db bigtable.BigtableDB, logger *zap.Logger, timestamp time.Time, addr []byte, o *gossipv1.Observation) error {
	newObservation := createNewObservation(timestamp, addr, o)

	message, err := db.GetMessage(context.TODO(), types.MessageID(o.MessageId))
	if err != nil {
		fmt.Printf("failed to get message: %v", err)
		return err
	}
	if message != nil {
		newObservation = checkObservationTime(message, newObservation)
	}

	return db.SaveObservationAndUpdateMessage(context.Background(), &newObservation)
}
