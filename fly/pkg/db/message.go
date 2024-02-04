package db

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/dgraph-io/badger/v3"
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

// QueryMessagesByIndex retrieves messages based on indexed attributes.
func (db *Database) QueryMessagesByIndex(metricsChecked bool, cutOffTime time.Duration) ([]*Message, error) {
	var messages []*Message
	now := time.Now()

	// Start a read-only transaction
	err := db.db.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.PrefetchValues = false // Only keys are needed
		it := txn.NewIterator(opts)
		defer it.Close()

		metricsCheckedPrefix := fmt.Sprintf("metricsChecked|%t|", metricsChecked)

		// Iterate over the metricsChecked index
		for it.Seek([]byte(metricsCheckedPrefix)); it.ValidForPrefix([]byte(metricsCheckedPrefix)); it.Next() {
			item := it.Item()
			key := item.Key()

			// Extract MessageID from the key and query lastObservedAt index
			_, messageID, err := parseMetricsCheckedIndexKey(key)
			if err != nil {
				return fmt.Errorf("failed to parse index key: %w", err)
			}

			message, err := db.GetMessage(messageID)
			if err != nil {
				return fmt.Errorf("failed to get message by ID: %w", err)
			}

			// Check if the last observed timestamp is before the specified hours
			if message.LastObservedAt.Before(now.Add(-cutOffTime)) {
				message.MetricsChecked = true
				db.SaveMessage(message)
				messages = append(messages, message)
			}
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}

	return messages, nil
}
