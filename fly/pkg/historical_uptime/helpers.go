package historical_uptime

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/db"
	"go.uber.org/zap"
)

func TallyMessagesPerChain(logger *zap.Logger, messages []*db.Message) map[string]int {
	messagesPerChain := make(map[string]int)
	for _, message := range messages {
		chainID, err := message.MessageID.ChainID()
		if err != nil {
			logger.Error("Invalid chain ID", zap.String("messageID", string(message.MessageID)))
			// Skip messages with invalid chain IDs
			continue
		}
		messagesPerChain[chainID]++
	}
	return messagesPerChain
}

func InitializeMissingObservationsCount(logger *zap.Logger, messages []*db.Message, messagesPerChain map[string]int) map[string]map[string]int {
	guardianMissingObservations := make(map[string]map[string]int)
	for _, message := range messages {
		chainID, err := message.MessageID.ChainID()
		if err != nil {
			logger.Error("Invalid chain ID", zap.String("messageID", string(message.MessageID)))
			// Skip messages with invalid chain IDs
			continue
		}

		for _, guardianName := range common.GetGuardianIndexToNameMap() {
			if guardianMissingObservations[guardianName] == nil {
				guardianMissingObservations[guardianName] = make(map[string]int)
			}
			// Initialize the count for this chain for each guardian with the number of messages for that chain
			guardianMissingObservations[guardianName][chainID] = messagesPerChain[chainID]
		}
	}

	return guardianMissingObservations
}

func DecrementMissingObservationsCount(logger *zap.Logger, guardianMissingObservations map[string]map[string]int, messages []*db.Message) {
	for _, message := range messages {
		chainID, err := message.MessageID.ChainID()
		if err != nil {
			logger.Error("Invalid chain ID", zap.String("messageID", string(message.MessageID)))
			continue
		}

		for _, observation := range message.Observations {
			guardianName, ok := common.GetGuardianName(observation.GuardianAddr)
			if !ok {
				logger.Error("Unknown guardian address", zap.String("guardianAddr", observation.GuardianAddr))
				continue
			}
			guardianMissingObservations[guardianName][chainID]--
		}
	}
}

func UpdateMetrics(guardianMissedObservations *prometheus.CounterVec, guardianMissingObservations map[string]map[string]int) {
	for guardianName, chains := range guardianMissingObservations {
		for chainID, missingCount := range chains {
			guardianMissedObservations.WithLabelValues(guardianName, chainID).Add(float64(missingCount))
		}
	}
}
