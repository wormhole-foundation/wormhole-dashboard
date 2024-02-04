package db

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/dgraph-io/badger/v3"
)

// Index keys formats
const (
	// Format for metricsChecked index key: metricsChecked|<bool>|<messageID>
	metricsCheckedIndexKeyFmt = "metricsChecked|%t|%s"
)

// CreateOrUpdateIndex creates or updates indexes for a message
func CreateOrUpdateIndex(txn *badger.Txn, message *Message) error {
	// Index for metricsChecked
	mcKey := fmt.Sprintf(metricsCheckedIndexKeyFmt, message.MetricsChecked, message.MessageID)
	if err := txn.Set([]byte(mcKey), []byte(message.MessageID)); err != nil {
		return fmt.Errorf("failed to set metricsChecked index: %w", err)
	}

	return nil
}

// parseMetricsCheckedIndexKey helper function to parse index key and extract values
func parseMetricsCheckedIndexKey(key []byte) (bool, string, error) {
	keyStr := string(key) // Convert byte slice to string
	parts := strings.Split(keyStr, "|")
	if len(parts) != 3 || parts[0] != "metricsChecked" {
		return false, "", fmt.Errorf("invalid key format")
	}

	// Parse the metricsChecked value from the string to a bool
	metricsChecked, err := strconv.ParseBool(parts[1])
	if err != nil {
		return false, "", fmt.Errorf("error parsing metricsChecked value from key: %w", err)
	}

	// The MessageID is the last part of the key
	messageID := parts[2]

	return metricsChecked, messageID, nil
}
