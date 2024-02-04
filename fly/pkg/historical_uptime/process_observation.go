package historical_uptime

import (
	"encoding/hex"
	"errors"

	node_common "github.com/certusone/wormhole/node/pkg/common"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/db"
	"go.uber.org/zap"
)

// createNewObservation creates a new observation from the given observation
func createNewObservation(o node_common.MsgWithTimeStamp[gossipv1.SignedObservation]) db.Observation {
	ga := eth_common.BytesToAddress(o.Msg.Addr).String()
	return db.Observation{
		GuardianAddr: ga,
		Signature:    hex.EncodeToString(o.Msg.Signature),
		ObservedAt:   o.Timestamp,
		Status:       db.OnTime,
	}
}

// createNewMessage creates a new message in the database
func createNewMessage(database db.Database, o node_common.MsgWithTimeStamp[gossipv1.SignedObservation], newObservation db.Observation) error {
	message := &db.Message{
		MessageID:      db.MessageID(o.Msg.MessageId),
		LastObservedAt: o.Timestamp,
		Observations: []db.Observation{
			newObservation,
		},
		MetricsChecked: false,
	}
	return database.SaveMessage(message)
}

// checkObservationTime checks if the observation is late
func checkObservationTime(message *db.Message, newObservation db.Observation) db.Observation {
	nextExpiry := message.LastObservedAt.Add(common.ExpiryDuration)
	if newObservation.ObservedAt.After(nextExpiry) {
		newObservation.Status = db.Late
	}
	return newObservation
}

// ProcessObservation processes an observation and updates the database accordingly.
// If the message does not exist in the database, it will be created.
// If the message exists, the observation will be appended to the message.
// If the observation is late, observation status will be set to Late.
func ProcessObservation(database db.Database, logger *zap.Logger, o node_common.MsgWithTimeStamp[gossipv1.SignedObservation]) error {
	message, err := database.GetMessage(o.Msg.MessageId)
	newObservation := createNewObservation(o)

	if err != nil {
		if errors.Is(err, db.ErrMessageNotFound) {
			// If the message does not exist in the database, create it since it's the first observation
			err = createNewMessage(database, o, newObservation)

			if err != nil {
				logger.Error("failed to create message", zap.Error(err))
				return err
			}

			// No need to process the message further since observation is added to the database
			return nil
		} else {
			logger.Error("failed to get message", zap.Error(err))
		}
	}

	newObservation = checkObservationTime(message, newObservation)

	return database.AppendObservationIfNotExist(o.Msg.MessageId, newObservation)
}
