package bigtable

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"cloud.google.com/go/bigtable"
	"google.golang.org/api/option"
)

// GuardianObservation represents an observation made by a guardian.
type Observation struct {
	MessageID    MessageID         `json:"messageId"`
	GuardianAddr string            `json:"guardianAddr"`
	Signature    string            `json:"signature"`
	ObservedAt   time.Time         `json:"observedAt"`
	Status       ObservationStatus `json:"status"`
}

type ObservationStatus int

// Message represents the data structure for a message in the Observations table.
type Message struct {
	MessageID      MessageID `json:"messageId"`
	LastObservedAt time.Time `json:"lastObservedAt"`
	MetricsChecked bool      `json:"metricsChecked"`
}

type MessageID string

type BigtableDB struct {
	client *bigtable.Client
}

const (
	MessageTableName      = "historical_uptime_messages"
	ObservationTableName  = "historical_uptime_observations"
	MessageIndexTableName = "historical_uptime_message_index"
)

func NewBigtableDB(ctx context.Context, projectID, instanceID, credentialsFile, emulatorHost string) (*BigtableDB, error) {
	var client *bigtable.Client
	var err error

	if credentialsFile != "" {
		client, err = bigtable.NewClient(ctx, projectID, instanceID, option.WithCredentialsFile(credentialsFile))
	} else if emulatorHost != "" {
		client, err = bigtable.NewClient(ctx, projectID, instanceID, option.WithoutAuthentication(), option.WithEndpoint(emulatorHost))
	} else {
		client, err = bigtable.NewClient(ctx, projectID, instanceID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create Bigtable client: %v", err)
	}

	db := &BigtableDB{
		client: client,
	}

	return db, nil
}

func (db *BigtableDB) Close() error {
	return db.client.Close()
}

// SaveMessage saves the message to the `messages` table.
// It also saves the message index to the `messageIndex` table. This is used to keep track of messages that are not processed.
func (db *BigtableDB) SaveMessage(ctx context.Context, message *Message) error {
	tableName := MessageTableName
	columnFamily := "messageData"

	rowKey := string(message.MessageID)
	lastObservedAtBytes, err := message.LastObservedAt.MarshalBinary()
	if err != nil {
		return fmt.Errorf("failed to marshal LastObservedAt: %v", err)
	}

	mut := bigtable.NewMutation()
	mut.Set(columnFamily, "lastObservedAt", bigtable.Now(), lastObservedAtBytes)
	mut.Set(columnFamily, "metricsChecked", bigtable.Now(), []byte(strconv.FormatBool(message.MetricsChecked)))

	err = db.client.Open(tableName).Apply(ctx, rowKey, mut)
	if err != nil {
		return fmt.Errorf("failed to save message: %v", err)
	}

	err = db.SaveMessageIndex(ctx, message.MessageID)
	if err != nil {
		return fmt.Errorf("failed to save message index: %v", err)
	}

	return nil
}

// MessageIndex is used to keep track of messages that are not processed (i.e. missing observation is not accounted for)
// This index is to reduce the data scanned when querying from the `messages` table to process.
// We might want to consider adding `lastObservedAt` to the index to further reduce the data scanned. A tradeoff is that
// we need to update the index whenever the `lastObservedAt` is updated, which is whenever a new observation is added.
// This could be a performance hit if we have a lot of observations.
func (db *BigtableDB) SaveMessageIndex(ctx context.Context, messageID MessageID) error {
	tableName := MessageIndexTableName
	columnFamily := "indexData"

	rowKey := string(messageID)

	mut := bigtable.NewMutation()
	// bigtable doesn't allow empty mutations, so we need to set a placeholder value
	mut.Set(columnFamily, "placeholder", bigtable.Now(), nil)
	err := db.client.Open(tableName).Apply(ctx, rowKey, mut)
	if err != nil {
		return fmt.Errorf("failed to save message index: %v", err)
	}

	return nil
}

// DeleteMessageIndex deletes the message index for the given messageID. This is used when the message is processed and
// missing observation is accounted for.
func (db *BigtableDB) DeleteMessageIndex(ctx context.Context, messageID MessageID) error {
	tableName := MessageIndexTableName

	rowKey := string(messageID)

	mut := bigtable.NewMutation()
	mut.DeleteRow()

	err := db.client.Open(tableName).Apply(ctx, rowKey, mut)
	if err != nil {
		return fmt.Errorf("failed to delete message index: %v", err)
	}

	return nil
}

func (db *BigtableDB) GetMessage(ctx context.Context, messageID MessageID) (*Message, error) {
	tableName := MessageTableName
	rowKey := string(messageID)

	table := db.client.Open(tableName)
	row, err := table.ReadRow(ctx, rowKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read message: %v", err)
	}

	if len(row) == 0 {
		return nil, fmt.Errorf("message not found: %s", messageID)
	}

	var message Message
	message.MessageID = messageID
	for _, item := range row["messageData"] {
		switch item.Column {
		case "messageData:lastObservedAt":
			var t time.Time
			if err := t.UnmarshalBinary(item.Value); err != nil {
				return nil, fmt.Errorf("failed to unmarshal LastObservedAt: %v", err)
			}
			message.LastObservedAt = t
		case "messageData:metricsChecked":
			metricsChecked, err := strconv.ParseBool(string(item.Value))
			if err != nil {
				return nil, fmt.Errorf("failed to parse MetricsChecked: %v", err)
			}
			message.MetricsChecked = metricsChecked
		}
	}

	return &message, nil
}

// SaveObservationAndUpdateMessage saves the observation only if it doesn't already exist.
// It also updates the lastObservedAt of the message.
func (db *BigtableDB) SaveObservationAndUpdateMessage(ctx context.Context, observation *Observation) error {
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

	timeBinary, err := observation.ObservedAt.MarshalBinary()
	if err != nil {
		return fmt.Errorf("failed to marshal ObservedAt: %v", err)
	}

	mut := bigtable.NewMutation()
	mut.Set(columnFamily, "signature", bigtable.Now(), []byte(observation.Signature))
	mut.Set(columnFamily, "observedAt", bigtable.Now(), timeBinary)
	mut.Set(columnFamily, "status", bigtable.Now(), []byte(strconv.Itoa(int(observation.Status))))

	err = db.client.Open(tableName).Apply(ctx, rowKey, mut)
	if err != nil {
		return fmt.Errorf("failed to save observation: %v", err)
	}

	messageRowKey := string(observation.MessageID)
	messageMut := bigtable.NewMutation()
	messageMut.Set("messageData", "lastObservedAt", bigtable.Now(), timeBinary)

	err = db.client.Open(MessageTableName).Apply(ctx, messageRowKey, messageMut)
	if err != nil {
		return fmt.Errorf("failed to update message: %v", err)
	}

	return nil
}

func (db *BigtableDB) GetObservation(ctx context.Context, messageID, guardianAddr string) (*Observation, error) {
	tableName := ObservationTableName
	rowKey := messageID + "_" + guardianAddr

	table := db.client.Open(tableName)
	row, err := table.ReadRow(ctx, rowKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read observation: %v", err)
	}

	if len(row) == 0 {
		return nil, fmt.Errorf("observation not found: %s", rowKey)
	}

	var observation Observation
	observation.MessageID = MessageID(messageID)
	observation.GuardianAddr = guardianAddr
	for _, item := range row["observationData"] {
		switch item.Column {
		case "observationData:signature":
			observation.Signature = string(item.Value)
		case "observationData:observedAt":
			var t time.Time
			if err := t.UnmarshalBinary(item.Value); err != nil {
				return nil, fmt.Errorf("failed to unmarshal LastObservedAt: %v", err)
			}
			observation.ObservedAt = t
		case "observationData:status":
			status, err := strconv.Atoi(string(item.Value))
			if err != nil {
				return nil, fmt.Errorf("failed to parse Status: %v", err)
			}
			observation.Status = ObservationStatus(status)
		}
	}

	return &observation, nil
}
