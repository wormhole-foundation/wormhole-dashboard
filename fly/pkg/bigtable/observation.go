package bigtable

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/bigtable"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
)

// SaveObservationAndUpdateMessage saves the observation only if it doesn't already exist.
// It also updates the lastObservedAt of the message.
func (db *BigtableDB) SaveObservationAndUpdateMessage(ctx context.Context, observation *types.Observation) error {
	tableName := ObservationTableName
	columnFamily := "observationData"

	rowKey := string(observation.MessageID) + "_" + observation.GuardianAddr

	// First, check if the observation already exists
	table := db.client.Open(tableName)
	row, err := table.ReadRow(ctx, rowKey)
	if err != nil {
		return fmt.Errorf("failed to read observation: %v", err)
	}

	// If the observation already exists, return without updating
	if len(row) > 0 {
		return nil
	}

	timeBinary, err := observation.ObservedAt.UTC().MarshalBinary()
	if err != nil {
		return fmt.Errorf("failed to marshal ObservedAt: %v", err)
	}

	// Setting the timestamp to 0 to prevent storing multiple versions of the same message.
	// We only need the latest version of the message.
	timestamp := bigtable.Timestamp(0)
	mut := bigtable.NewMutation()
	mut.Set(columnFamily, "signature", timestamp, []byte(observation.Signature))
	mut.Set(columnFamily, "observedAt", timestamp, timeBinary)
	mut.Set(columnFamily, "status", timestamp, []byte(strconv.Itoa(int(observation.Status))))

	err = db.client.Open(tableName).Apply(ctx, rowKey, mut)
	if err != nil {
		return fmt.Errorf("failed to save observation: %v", err)
	}

	// Check if the message already exists
	dbMessage, err := db.GetMessage(ctx, observation.MessageID)
	if err != nil {
		return err
	}

	if dbMessage == nil {
		return db.CreateMessageAndMessageIndex(ctx, &types.Message{
			MessageID:      observation.MessageID,
			LastObservedAt: observation.ObservedAt,
			MetricsChecked: false,
		})
	}

	// If the observation is older than the last observed time, don't update
	// If the message has expired, we don't want to update the last observed time as we want to keep the last observed time
	if dbMessage.LastObservedAt.After(observation.ObservedAt) || dbMessage.LastObservedAt.Before(observation.ObservedAt.Add(-common.ExpiryDuration)) {
		return nil
	}

	dbMessage.LastObservedAt = observation.ObservedAt
	return db.CreateMessageAndMessageIndex(ctx, dbMessage)
}

func (db *BigtableDB) parseObservationRowKey(rowKey string) (types.MessageID, string, error) {
	parts := strings.Split(rowKey, "_")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid observation row key: %s", rowKey)
	}

	return types.MessageID(parts[0]), parts[1], nil
}

// bigtableRowToObservation works on the assumption that we only keep the latest version of the observation.
// If there are multiple versions of the same observation, the last one returned in the response will be returned.
func (db *BigtableDB) bigtableRowToObservation(row bigtable.Row) (*types.Observation, error) {
	var observation types.Observation
	messageId, guardianAddr, err := db.parseObservationRowKey(row.Key())
	if err != nil {
		return nil, fmt.Errorf("failed to parse observation row key: %v", err)
	}
	observation.MessageID = messageId
	observation.GuardianAddr = guardianAddr

	for _, column := range row["observationData"] {
		switch column.Column {
		case "observationData:signature":
			observation.Signature = string(column.Value)
		case "observationData:observedAt":
			var t time.Time
			if err := t.UnmarshalBinary(column.Value); err != nil {
				return nil, fmt.Errorf("failed to unmarshal LastObservedAt: %v", err)
			}
			observation.ObservedAt = t
		case "observationData:status":
			status, err := strconv.Atoi(string(column.Value))
			if err != nil {
				return nil, fmt.Errorf("failed to parse Status: %v", err)
			}
			observation.Status = types.ObservationStatus(status)
		}
	}

	return &observation, nil
}

func (db *BigtableDB) GetObservationsByMessageID(ctx context.Context, messageID string) ([]*types.Observation, error) {
	tableName := ObservationTableName
	prefix := messageID + "_"

	observations := make([]*types.Observation, 0)

	err := db.client.Open(tableName).ReadRows(ctx, bigtable.PrefixRange(prefix), func(row bigtable.Row) bool {
		observation := new(types.Observation)
		observation.MessageID = types.MessageID(messageID)
		observation.GuardianAddr = strings.TrimPrefix(row.Key(), prefix)

		observation, err := db.bigtableRowToObservation(row)
		if err != nil {
			return false
		}

		observations = append(observations, observation)
		return true
	})

	if err != nil {
		return nil, fmt.Errorf("failed to read observations: %v", err)
	}

	return observations, nil
}
