package bigtable

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"cloud.google.com/go/bigtable"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
	"google.golang.org/api/option"
)

type BigtableDB struct {
	client *bigtable.Client
}

const (
	MessageTableName      = "historical_uptime_messages"
	ObservationTableName  = "historical_uptime_observations"
	MessageIndexTableName = "historical_uptime_message_index"
)

func NewBigtableDB(ctx context.Context, projectID, instanceID, credentialsFile, emulatorHost string, useBigtableEmulator bool) (*BigtableDB, error) {
	var client *bigtable.Client
	var err error

	if !useBigtableEmulator && credentialsFile != "" {
		client, err = bigtable.NewClient(ctx, projectID, instanceID, option.WithCredentialsFile(credentialsFile))
	} else if useBigtableEmulator && emulatorHost != "" {
		client, err = bigtable.NewClient(ctx, projectID, instanceID, option.WithoutAuthentication(), option.WithEndpoint(emulatorHost))
		SetupEmulator()
	} else {
		return nil, errors.New("invalid Bigtable configuration, if using emulator, set emulatorHost, else set credentialsFile")
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

// CreateMessageAndMessageIndex saves the message to the `messages` table if doesn't exist.
// It also saves the message index to the `messageIndex` table. This is used to keep track of messages that are not processed.
func (db *BigtableDB) CreateMessageAndMessageIndex(ctx context.Context, message *types.Message) error {
	tableName := MessageTableName
	columnFamily := "messageData"

	rowKey := string(message.MessageID)
	// bigtable keeps the time in original timezone settings, so we need to convert it to UTC to be consistent
	lastObservedAtBytes, err := message.LastObservedAt.UTC().MarshalBinary()
	if err != nil {
		return err
	}

	// Setting the timestamp to 0 to prevent storing multiple versions of the same message.
	// We only need the latest version of the message.
	timestamp := bigtable.Timestamp(0)
	mut := bigtable.NewMutation()
	mut.Set(columnFamily, "lastObservedAt", timestamp, lastObservedAtBytes)
	mut.Set(columnFamily, "metricsChecked", timestamp, []byte(strconv.FormatBool(message.MetricsChecked)))

	err = db.client.Open(tableName).Apply(ctx, rowKey, mut)
	if err != nil {
		return err
	}

	err = db.SaveMessageIndex(ctx, message.MessageID)
	if err != nil {
		return err
	}

	return nil
}

func (db *BigtableDB) SaveMessages(ctx context.Context, messages []*types.Message) error {
	tableName := MessageTableName
	columnFamily := "messageData"

	var rowKeys []string
	var muts []*bigtable.Mutation

	timestamp := bigtable.Timestamp(0)
	for _, message := range messages {
		rowKey := string(message.MessageID)
		rowKeys = append(rowKeys, rowKey)

		lastObservedAtBytes, err := message.LastObservedAt.UTC().MarshalBinary()
		if err != nil {
			return err
		}

		mut := bigtable.NewMutation()
		mut.Set(columnFamily, "lastObservedAt", timestamp, lastObservedAtBytes)
		mut.Set(columnFamily, "metricsChecked", timestamp, []byte(strconv.FormatBool(message.MetricsChecked)))
		muts = append(muts, mut)
	}

	errs, err := db.client.Open(tableName).ApplyBulk(ctx, rowKeys, muts)
	if err != nil {
		return fmt.Errorf("failed to save messages: %v", err)
	}

	for _, err := range errs {
		if err != nil {
			return fmt.Errorf("failed to save message: %v", err)
		}
	}

	return nil
}

func (db *BigtableDB) GetMessage(ctx context.Context, messageID types.MessageID) (*types.Message, error) {
	tableName := MessageTableName
	rowKey := string(messageID)

	table := db.client.Open(tableName)
	row, err := table.ReadRow(ctx, rowKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read message: %v", err)
	}

	if len(row) == 0 {
		return nil, nil
	}

	message, err := db.bigtableRowToMessage(row)
	if err != nil {
		return nil, fmt.Errorf("failed to convert row to message: %v", err)
	}

	return message, nil
}

// GetUnprocessedMessagesBeforeCutOffTime returns all messages that have a message index, aka not processed older than the cutOffTime.
// Here we do not need to filter by `metricsChecked“ field since we assume that the messages in messageIndex table have the `metricsChecked` field set to false.
func (db *BigtableDB) GetUnprocessedMessagesBeforeCutOffTime(ctx context.Context, cutOffTime time.Time) ([]*types.Message, error) {
	// Step 1: Get all message indexes
	messageIndexes, err := db.GetAllMessageIndexes(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get message indexes: %v", err)
	}

	// Step 2: Use the row keys from messageIndex to get the messages
	rowKeys := make([]string, len(messageIndexes))
	for i, index := range messageIndexes {
		rowKeys[i] = string(index)
	}

	messages, err := db.GetMessagesByRowKeys(ctx, rowKeys)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages: %v", err)
	}

	// Step 3: Filter messages based on cutOffTime
	var filteredMessages []*types.Message
	var checkedMessagesId []types.MessageID
	for _, message := range messages {
		if message.LastObservedAt.Before(cutOffTime) {
			filteredMessages = append(filteredMessages, message)
			checkedMessagesId = append(checkedMessagesId, message.MessageID)
			message.MetricsChecked = true
		}
	}

	// Step 4: Delete the message indexes
	err = db.DeleteMessageIndexes(ctx, checkedMessagesId)
	if err != nil {
		return nil, fmt.Errorf("failed to delete message indexes: %v", err)
	}

	// Step 5: Mark the messages as processed after deleting message indexes
	err = db.SaveMessages(ctx, filteredMessages)
	if err != nil {
		return nil, fmt.Errorf("failed to save messages: %v", err)
	}

	return filteredMessages, nil
}

// This works on the assumption that there is only one version of the message.
// If there are multiple versions of the message, this will return which version is read last.
func (db *BigtableDB) bigtableRowToMessage(row bigtable.Row) (*types.Message, error) {
	var message types.Message
	message.MessageID = types.MessageID(row.Key())

	for _, column := range row["messageData"] {
		switch column.Column {
		case "messageData:lastObservedAt":
			var lastObservedAt time.Time
			if err := lastObservedAt.UnmarshalBinary(column.Value); err != nil {
				return nil, fmt.Errorf("failed to unmarshal LastObservedAt: %v", err)
			}
			// bigtable keeps the time in original timezone settings, so we need to convert it to UTC to be consistent
			message.LastObservedAt = lastObservedAt.UTC()
		case "messageData:metricsChecked":
			metricsChecked, err := strconv.ParseBool(string(column.Value))
			if err != nil {
				return nil, fmt.Errorf("failed to parse MetricsChecked: %v", err)
			}
			message.MetricsChecked = metricsChecked
		}
	}

	return &message, nil
}

func (db *BigtableDB) GetMessagesByRowKeys(ctx context.Context, rowKeys []string) ([]*types.Message, error) {
	tableName := MessageTableName
	table := db.client.Open(tableName)

	var messages []*types.Message
	var errors []error

	const batchSize = 1000

	for i := 0; i < len(rowKeys); i += batchSize {
		end := i + batchSize
		if end > len(rowKeys) {
			end = len(rowKeys)
		}
		batchRowKeys := rowKeys[i:end]

		err := table.ReadRows(ctx, bigtable.RowList(batchRowKeys), func(row bigtable.Row) bool {
			message, err := db.bigtableRowToMessage(row)
			if err != nil {
				errors = append(errors, fmt.Errorf("failed to convert row to message: %v", err))
				return true
			}

			messages = append(messages, message)
			return true
		})

		if err != nil {
			return nil, fmt.Errorf("failed to read messages: %v", err)
		}
	}

	if len(errors) > 0 {
		fmt.Printf("Errors occurred while reading messages: %v", errors)
	}

	return messages, nil
}
