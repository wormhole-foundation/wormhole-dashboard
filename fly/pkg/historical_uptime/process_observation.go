package historical_uptime

import (
	"context"
	"encoding/hex"
	"fmt"

	node_common "github.com/certusone/wormhole/node/pkg/common"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/bigtable"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
	"go.uber.org/zap"
)

// createNewObservation creates a new observation from the given observation
func createNewObservation(o node_common.MsgWithTimeStamp[gossipv1.SignedObservation]) types.Observation {
	ga := eth_common.BytesToAddress(o.Msg.Addr).String()
	return types.Observation{
		MessageID:    types.MessageID(o.Msg.MessageId),
		GuardianAddr: ga,
		Signature:    hex.EncodeToString(o.Msg.Signature),
		ObservedAt:   o.Timestamp,
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
func ProcessObservation(db bigtable.BigtableDB, logger *zap.Logger, o node_common.MsgWithTimeStamp[gossipv1.SignedObservation]) error {
	newObservation := createNewObservation(o)

	message, err := db.GetMessage(context.TODO(), types.MessageID(o.Msg.MessageId))
	if err != nil {
		fmt.Printf("failed to get message: %v", err)
		return err
	}
	if message != nil {
		newObservation = checkObservationTime(message, newObservation)
	}

	return db.SaveObservationAndUpdateMessage(context.Background(), &newObservation)
}
