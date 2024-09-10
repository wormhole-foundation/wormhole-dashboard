package historical_uptime

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
	"go.uber.org/zap"
)

func TallyMessagesPerChain(logger *zap.Logger, messages []*types.Message) map[string]int {
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

func InitializeMissingObservationsCount(logger *zap.Logger, messages []*types.Message, messagesPerChain map[string]int) map[string]map[string]int {
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

func DecrementMissingObservationsCount(logger *zap.Logger, guardianMissingObservations map[string]map[string]int, messageObservations map[types.MessageID][]*types.Observation) {
	// Keep track of processed observations to avoid duplicates
	processed := make(map[string]map[string]struct{})

	for messageID, observations := range messageObservations {
		chainID, err := messageID.ChainID()
		if err != nil {
			logger.Error("Invalid chain ID", zap.String("messageID", string(messageID)))
			continue
		}

		for _, observation := range observations {
			guardianName, ok := common.GetGuardianName(observation.GuardianAddr)
			if !ok {
				logger.Error("Unknown guardian address", zap.String("guardianAddr", observation.GuardianAddr))
				continue
			}

			// Check if we've already processed this guardian for this message
			if processed[string(messageID)] == nil {
				processed[string(messageID)] = make(map[string]struct{})
			}

			if _, exists := processed[string(messageID)][guardianName]; exists {
				logger.Warn("Duplicate observation", zap.String("messageID", string(messageID)), zap.String("guardian", guardianName))
				continue
			}

			// Mark as processed
			processed[string(messageID)][guardianName] = struct{}{}

			// Safely decrement the count
			if guardianMissingObservations[guardianName] == nil {
				guardianMissingObservations[guardianName] = make(map[string]int)
			}
			if guardianMissingObservations[guardianName][chainID] > 0 {
				guardianMissingObservations[guardianName][chainID]--
			} else {
				logger.Warn("Attempted to decrement below zero",
					zap.String("guardian", guardianName),
					zap.String("chainID", chainID),
					zap.Int("currentCount", guardianMissingObservations[guardianName][chainID]))
			}
		}
	}
}

func UpdateMetrics(logger *zap.Logger, guardianMissedObservations *prometheus.CounterVec, guardianMissingObservations map[string]map[string]int) {
	for guardianName, chains := range guardianMissingObservations {
		for chainID, missingCount := range chains {
			if missingCount < 0 {
				logger.Warn("Skipping negative missing count", zap.String("chainID", chainID), zap.Int("missingCount", missingCount))
				continue
			}
			guardianMissedObservations.WithLabelValues(guardianName, chainID).Add(float64(missingCount))
		}
	}
}

func computeMaxChainHeights(guardianChainHeights common.GuardianChainHeights) common.ChainHeights {
	maxChainHeights := make(common.ChainHeights)

	for chainId, guardianHeights := range guardianChainHeights {
		highest := uint64(0)

		for _, heightInfo := range guardianHeights {
			if highest < heightInfo.Latest {
				highest = heightInfo.Latest
			}
		}

		maxChainHeights[chainId] = highest
	}

	return maxChainHeights
}

func computeGuardianChainHeightDifferences(guardianChainHeights common.GuardianChainHeights, maxChainHeights common.ChainHeights) common.GuardianChainHeights {
	heightDifferences := make(common.GuardianChainHeights)

	for chainId, guardianHeights := range guardianChainHeights {
		for guardian, heightInfo := range guardianHeights {
			if heightDifferences[chainId] == nil {
				heightDifferences[chainId] = make(common.GuardianHeight)
			}

			heightDifferences[chainId][guardian] = common.HeightInfo{
				Latest:    maxChainHeights[chainId] - heightInfo.Latest,
				Safe:      0, // We're not calculating differences for Safe
				Finalized: 0, // We're not calculating differences for Finalized
			}
		}
	}

	return heightDifferences
}

func GetGuardianHeightDifferencesByChain(guardianChainHeights common.GuardianChainHeights) common.GuardianChainHeights {
	maxChainHeights := computeMaxChainHeights(guardianChainHeights)
	return computeGuardianChainHeightDifferences(guardianChainHeights, maxChainHeights)
}
