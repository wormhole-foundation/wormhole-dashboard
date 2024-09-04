package historical_uptime

import (
	"context"
	"encoding/hex"
	"time"

	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/bigtable"

	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
	"go.uber.org/zap"
)

var cache = bigtable.NewObservationCache()

// ProcessObservationBatch processes a batch of observations and flushes the cache to the database.
func ProcessObservationBatch(db bigtable.BigtableDB, logger *zap.Logger, batch []*types.Observation) error {
	cache.Lock()
	defer cache.Unlock()

	for _, o := range batch {
		ProcessObservationAlreadyLocked(db, logger, o)
	}

	return FlushCache(db, logger)
}

// FlushCache writes the cached observations and messages to the database and clears the cache.
func FlushCache(db bigtable.BigtableDB, logger *zap.Logger) error {
	ctx := context.Background()

	err := db.FlushCache(ctx, logger, cache)
	if err != nil {
		return err
	}

	// Clear the cache after flushing
	cache.Messages = make(map[types.MessageID]*types.Message)
	cache.Observations = make(map[types.MessageID]map[string]*types.Observation)

	return nil
}

// ProcessObservationAlreadyLocked processes a single observation, updating the cache and checking observation times.
// This function assumes that the cache lock has already been acquired.
func ProcessObservationAlreadyLocked(db bigtable.BigtableDB, logger *zap.Logger, o *types.Observation) {
	// Check if the message exists in the cache, if not, try to fetch from the database
	message, exists := cache.Messages[o.MessageID]
	if !exists {
		// Try to get the message from the database
		dbMessage, err := db.GetMessage(context.Background(), o.MessageID)
		if err != nil {
			logger.Error("Failed to get message from database", zap.Error(err))
		}
		if dbMessage != nil {
			message = dbMessage
			cache.Messages[o.MessageID] = message
		} else {
			// Create a new message if it doesn't exist in the database
			message = &types.Message{
				MessageID:      o.MessageID,
				LastObservedAt: o.ObservedAt,
				MetricsChecked: false,
			}
			// Put message in cache, likely observation for the message happens around the same time so this will
			// reduce the db calls
			cache.Messages[o.MessageID] = message
		}
	}

	checkObservationTime(message, o)

	// Initialize the observations map for this message if it doesn't exist
	if cache.Observations[o.MessageID] == nil {
		cache.Observations[o.MessageID] = make(map[string]*types.Observation)
		// Try to get existing observations from the database
		// This is for deduping observations. We do not want to persist duplicated observations
		dbObservations, err := db.GetObservationsByMessageID(context.Background(), string(o.MessageID))
		if err != nil {
			logger.Error("Failed to get observations from database", zap.Error(err))
		}
		for _, dbObs := range dbObservations {
			cache.Observations[o.MessageID][dbObs.GuardianAddr] = dbObs
		}
	}

	// Add the new observation if it doesn't exist
	if _, exists := cache.Observations[o.MessageID][o.GuardianAddr]; !exists {
		cache.Observations[o.MessageID][o.GuardianAddr] = o

		// Update LastObservedAt only if it's a new observation and within the expiry duration
		if o.ObservedAt.After(message.LastObservedAt) &&
			!o.ObservedAt.After(message.LastObservedAt.Add(common.ExpiryDuration)) {
			message.LastObservedAt = o.ObservedAt
		}
	}
}

// CreateNewObservation creates a new observation from the given parameters.
func CreateNewObservation(messageID string, signature []byte, timestamp time.Time, addr []byte) *types.Observation {
	ga := eth_common.BytesToAddress(addr).String()
	return &types.Observation{
		MessageID:    types.MessageID(messageID),
		GuardianAddr: ga,
		Signature:    hex.EncodeToString(signature),
		ObservedAt:   timestamp,
		Status:       types.OnTime,
	}
}

// checkObservationTime checks if the observation is late based on the message's last observed time.
func checkObservationTime(message *types.Message, newObservation *types.Observation) {
	nextExpiry := message.LastObservedAt.UTC().Add(common.ExpiryDuration)
	if newObservation.ObservedAt.UTC().After(nextExpiry) {
		newObservation.Status = types.Late
	}
}
