package db

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/dgraph-io/badger/v3"
	"github.com/wormhole-foundation/wormhole-monitor/fly/common"
	"github.com/wormhole-foundation/wormhole/sdk/vaa"
)

// Message represents the data structure for a message in the Observations table.
type Message struct {
	MessageID      MessageID     `json:"messageId"`
	LastObservedAt time.Time     `json:"lastObservedAt"`
	Observations   []Observation `json:"observations"`
	MetricsChecked bool          `json:"metricsChecked"`
}

type MessageID string

func (m MessageID) ChainID() (string, error) {
	// Parse the MessageID and return only the EmitterChain as a string
	parts := strings.Split(string(m), "/")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid MessageID format: %s", string(m))
	}
	emitterChain, err := strconv.Atoi(parts[0])
	if err != nil {
		return "", fmt.Errorf("failed to parse emitter chain from MessageID: %s, error: %v", string(m), err)
	}
	return vaa.ChainID(emitterChain).String(), nil
}

// GuardianObservation represents an observation made by a guardian.
type Observation struct {
	GuardianAddr string            `json:"guardianAddr"`
	Signature    string            `json:"signature"`
	ObservedAt   time.Time         `json:"observedAt"`
	Status       ObservationStatus `json:"status"`
}

type ObservationStatus int

const (
	OnTime ObservationStatus = iota
	// Late indicates that the observation was made 30 hours after the last observed timestamp
	Late
)

func (s ObservationStatus) String() string {
	switch s {
	case OnTime:
		return "OnTime"
	case Late:
		return "Late"
	default:
		return fmt.Sprintf("Unknown(%d)", s)
	}
}

var (
	// ErrMessageNotFound is returned when a message is not found in the database.
	ErrMessageNotFound = errors.New("message not found")
)

// SaveMessage Creates a new message in the database.
func (db *Database) SaveMessage(message *Message) error {
	// Marshal the Message struct into JSON bytes
	data, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// Use the marshaled JSON bytes as the value for the key-value pair in the database
	return db.db.Update(func(txn *badger.Txn) error {
		if err := CreateOrUpdateIndex(txn, message); err != nil {
			return fmt.Errorf("failed to create or update index: %w", err)
		}
		return txn.Set([]byte(message.MessageID), data)
	})
}

// GetMessage Retrieves a message from the database.
func (db *Database) GetMessage(messageID string) (*Message, error) {
	message := &Message{}

	// Retrieve the value for the given key from the database
	err := db.db.View(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte(messageID))
		if err != nil {
			return err
		}

		// Unmarshal the JSON bytes into a Message struct
		return item.Value(func(val []byte) error {
			return json.Unmarshal(val, message)
		})
	})

	if err != nil {
		if errors.Is(err, badger.ErrKeyNotFound) {
			return nil, ErrMessageNotFound
		}
		return nil, fmt.Errorf("failed to get message: %w", err)
	}

	return message, nil
}

// AppendObservationIfNotExist Appends an observation to a message in the database.
// Assumes that the message already exists in the database.
// Message is created in ProcessObservation if it does not exist.
func (db *Database) AppendObservationIfNotExist(messageID string, observation Observation) error {
	return db.db.Update(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte(messageID))
		if err != nil {
			return err
		}

		var message Message
		err = item.Value(func(val []byte) error {
			return json.Unmarshal(val, &message)
		})
		if err != nil {
			return err
		}

		// Check if the observation already exists in the message
		for _, o := range message.Observations {
			if o.GuardianAddr == observation.GuardianAddr {
				return nil
			}
		}

		message.Observations = append(message.Observations, observation)

		// Update the LastObservedAt field if the observation is on time
		if observation.Status == OnTime {
			message.LastObservedAt = observation.ObservedAt
		}

		// Marshal the updated Message struct into JSON bytes
		data, err := json.Marshal(message)
		if err != nil {
			return fmt.Errorf("failed to marshal updated message: %w", err)
		}

		// Use the marshaled JSON bytes to update the key-value pair in the database
		return txn.Set([]byte(message.MessageID), data)
	})
}

// batchUpdateMessages performs batch updates on a slice of messages.
func (db *Database) batchUpdateMessages(messages []*Message) error {
	for i := 0; i < len(messages); i += common.MessageUpdateBatchSize {
		end := i + common.MessageUpdateBatchSize
		if end > len(messages) {
			end = len(messages)
		}
		if err := db.updateMessagesBatch(messages[i:end]); err != nil {
			return err
		}
	}
	return nil
}

// updateMessagesBatch updates a batch of messages in a single transaction.
func (db *Database) updateMessagesBatch(messagesBatch []*Message) error {
	return db.db.Update(func(txn *badger.Txn) error {
		for _, message := range messagesBatch {
			data, err := json.Marshal(message)
			if err != nil {
				return fmt.Errorf("failed to marshal message: %w", err)
			}
			if err := txn.Set([]byte(message.MessageID), data); err != nil {
				return fmt.Errorf("failed to save message: %w", err)
			}
		}
		return nil
	})
}

// iterateIndex iterates over a metricsChecked index and applies a callback function to each item.
func (db *Database) iterateIndex(metricsChecked bool, callback func(item *badger.Item) error) error {
	opts := badger.DefaultIteratorOptions
	opts.PrefetchValues = false // Only keys are needed
	return db.db.View(func(txn *badger.Txn) error {
		it := txn.NewIterator(opts)
		defer it.Close()

		metricsCheckedPrefix := fmt.Sprintf("metricsChecked|%t|", metricsChecked)
		for it.Seek([]byte(metricsCheckedPrefix)); it.ValidForPrefix([]byte(metricsCheckedPrefix)); it.Next() {
			if err := callback(it.Item()); err != nil {
				return err
			}
		}
		return nil
	})
}

// processMessage retrieves a message from the database and applies an update function to it if the message is older than the cut-off time
func (db *Database) processMessage(messageID string, now time.Time, cutOffTime time.Duration, updateFunc func(*Message) bool) (*Message, error) {
	message, err := db.GetMessage(messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to get message by ID: %w", err)
	}

	if message.LastObservedAt.Before(now.Add(-cutOffTime)) && updateFunc(message) {
		return message, nil
	}
	return nil, nil
}

// QueryMessagesByIndex retrieves messages based on indexed attributes.
func (db *Database) QueryMessagesByIndex(metricsChecked bool, cutOffTime time.Duration) ([]*Message, error) {
	var messagesToUpdate []*Message
	now := time.Now()

	err := db.iterateIndex(metricsChecked, func(item *badger.Item) error {
		key := item.Key()
		_, messageID, err := parseMetricsCheckedIndexKey(key)
		if err != nil {
			return fmt.Errorf("failed to parse index key: %w", err)
		}

		message, err := db.processMessage(messageID, now, cutOffTime, func(m *Message) bool {
			m.MetricsChecked = true
			return true
		})

		if err != nil {
			return err
		}

		if message != nil {
			messagesToUpdate = append(messagesToUpdate, message)

			if (len(messagesToUpdate) % common.MessageUpdateBatchSize) == 0 {
				if err := db.batchUpdateMessages(messagesToUpdate); err != nil {
					return fmt.Errorf("failed to batch update messages: %w", err)
				}
				messagesToUpdate = messagesToUpdate[:0]
			}
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}

	if err := db.batchUpdateMessages(messagesToUpdate); err != nil {
		return nil, fmt.Errorf("failed to batch update messages: %w", err)
	}

	return messagesToUpdate, nil
}

// removeMessagesByIndex dynamically deletes messages in batches based on indexed attributes.
func (db *Database) RemoveMessagesByIndex(metricsChecked bool, cutOffTime time.Duration) error {
	messageIDsToDelete := make([]string, 0)
	now := time.Now()

	// Iterate over the index to find messages to delete
	err := db.iterateIndex(metricsChecked, func(item *badger.Item) error {
		key := item.Key()
		_, messageID, err := parseMetricsCheckedIndexKey(key)
		if err != nil {
			return fmt.Errorf("failed to parse index key: %w", err)
		}

		message, err := db.processMessage(messageID, now, cutOffTime, func(m *Message) bool {
			// return true since we just want to delete the message, no updating is needed
			return true
		})

		if err != nil {
			return err
		}

		if message != nil {
			messageIDsToDelete = append(messageIDsToDelete, messageID)
		}

		// Delete messages in batches to reduce total memory usage at a time
		if len(messageIDsToDelete) >= common.MessageUpdateBatchSize {
			if err := db.deleteMessagesBatch(messageIDsToDelete); err != nil {
				return fmt.Errorf("failed to delete messages: %w", err)
			}
			messageIDsToDelete = make([]string, 0)
		}

		return nil
	})

	if err != nil {
		return err
	}

	return db.deleteMessagesBatch(messageIDsToDelete)
}

func (db *Database) deleteMessagesBatch(messageIDs []string) error {
	return db.db.Update(func(txn *badger.Txn) error {
		for _, messageID := range messageIDs {
			err := txn.Delete([]byte(messageID))
			// deleting the message should delete the index as well
			mcKey := fmt.Sprintf(metricsCheckedIndexKeyFmt, true, messageID)
			if err := txn.Delete([]byte(mcKey)); err != nil {
				return fmt.Errorf("failed to delete index for messageID %s: %w", messageID, err)
			}
			if err != nil {
				// Depending on your error handling strategy, you might want to log this error
				// and continue, or you might want to return the error immediately.
				return fmt.Errorf("failed to delete messageID %s: %w", messageID, err)
			}
		}
		return nil
	})
}
