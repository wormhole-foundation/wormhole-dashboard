package bigtable

import (
	"context"
	"fmt"
	"strconv"

	"cloud.google.com/go/bigtable"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
	"go.uber.org/zap"
)

// Method to apply bulk mutations to bigtable
// This method can perform both inserts and updates:
// - If a row doesn't exist, it will be inserted
// - If a row already exists, the specified columns will be updated
func (db *BigtableDB) ApplyBulk(ctx context.Context, tableName string, rowKeys []string, muts []*bigtable.Mutation) error {
	if len(rowKeys) != len(muts) {
		return fmt.Errorf("mismatch between number of row keys (%d) and mutations (%d)", len(rowKeys), len(muts))
	}

	table := db.client.Open(tableName)
	errs, err := table.ApplyBulk(ctx, rowKeys, muts)
	if err != nil {
		return fmt.Errorf("failed to apply bulk mutations: %v", err)
	}

	for i, err := range errs {
		if err != nil {
			return fmt.Errorf("failed to apply mutation for row %s: %v", rowKeys[i], err)
		}
	}

	return nil
}

// Takes the cached data and flush it to bigtable
func (db *BigtableDB) FlushCache(ctx context.Context, logger *zap.Logger, cache *ObservationCache) error {
	// Prepare bulk mutations for messages
	messageMuts := make([]*bigtable.Mutation, 0, len(cache.Messages))
	messageRows := make([]string, 0, len(cache.Messages))

	// Prepare bulk mutations for observations
	observationMuts := make([]*bigtable.Mutation, 0)
	observationRows := make([]string, 0)

	for messageID, message := range cache.Messages {
		// Prepare message mutation
		messageMut, err := createMessageMutation(message)
		if err != nil {
			logger.Error("Failed to create message mutation", zap.String("messageID", string(messageID)), zap.Error(err))
			continue
		}
		messageMuts = append(messageMuts, messageMut)
		messageRows = append(messageRows, string(messageID))

		// Prepare observation mutations
		for _, observation := range cache.Observations[messageID] {
			observationMut, observationRow, err := createObservationMutation(observation)
			if err != nil {
				logger.Error("Failed to create observation mutation", zap.String("messageID", string(messageID)), zap.String("guardianAddr", observation.GuardianAddr), zap.Error(err))
				continue
			}
			observationMuts = append(observationMuts, observationMut)
			observationRows = append(observationRows, observationRow)
		}
	}

	err := db.ApplyBulk(ctx, MessageTableName, messageRows, messageMuts)
	if err != nil {
		logger.Error("Failed to apply bulk mutations for messages", zap.Error(err))
		return err
	}

	err = db.ApplyBulk(ctx, ObservationTableName, observationRows, observationMuts)
	if err != nil {
		logger.Error("Failed to apply bulk mutations for observations", zap.Error(err))
		return err
	}

	return nil
}

// Mutation to update lastObservedAt and metricsChecked
func createMessageMutation(message *types.Message) (*bigtable.Mutation, error) {
	lastObservedAtBytes, err := message.LastObservedAt.UTC().MarshalBinary()
	if err != nil {
		return nil, err
	}

	mut := bigtable.NewMutation()
	mut.Set("messageData", "lastObservedAt", bigtable.Timestamp(0), lastObservedAtBytes)
	mut.Set("messageData", "metricsChecked", bigtable.Timestamp(0), []byte(strconv.FormatBool(message.MetricsChecked)))

	return mut, nil
}

// Mutation to update observation data
func createObservationMutation(observation *types.Observation) (*bigtable.Mutation, string, error) {
	rowKey := string(observation.MessageID) + "_" + observation.GuardianAddr

	timeBinary, err := observation.ObservedAt.UTC().MarshalBinary()
	if err != nil {
		return nil, "", err
	}

	mut := bigtable.NewMutation()
	mut.Set("observationData", "signature", bigtable.Timestamp(0), []byte(observation.Signature))
	mut.Set("observationData", "observedAt", bigtable.Timestamp(0), timeBinary)
	mut.Set("observationData", "status", bigtable.Timestamp(0), []byte(strconv.Itoa(int(observation.Status))))

	return mut, rowKey, nil
}
