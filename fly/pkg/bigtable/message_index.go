package bigtable

import (
	"context"
	"fmt"

	"cloud.google.com/go/bigtable"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
)


// MessageIndex is used to keep track of messages that are not processed (i.e. missing observation is not accounted for)
// This index is to reduce the data scanned when querying from the `messages` table to process.
// We might want to consider adding `lastObservedAt` to the index to further reduce the data scanned. A tradeoff is that
// we need to update the index whenever the `lastObservedAt` is updated, which is whenever a new observation is added.
// This could be a performance hit if we have a lot of observations.
func (db *BigtableDB) SaveMessageIndex(ctx context.Context, messageID types.MessageID) error {
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
func (db *BigtableDB) DeleteMessageIndex(ctx context.Context, messageID types.MessageID) error {
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

// DeleteMessageIndexes deletes the message index for a batch of messageIDs. This is used when the messages are processed and
// missing observations are accounted for.
func (db *BigtableDB) DeleteMessageIndexes(ctx context.Context, messageIDs []types.MessageID) error {
    tableName := MessageIndexTableName

    var rowKeys []string
    var muts []*bigtable.Mutation

    for _, messageID := range messageIDs {
        rowKey := string(messageID)
        rowKeys = append(rowKeys, rowKey)

        mut := bigtable.NewMutation()
        mut.DeleteRow()
        muts = append(muts, mut)
    }

    errs, err := db.client.Open(tableName).ApplyBulk(ctx, rowKeys, muts)
    if err != nil {
        return fmt.Errorf("failed to bulk delete message index: %v", err)
    }

    for _, err := range errs {
        if err != nil {
            return fmt.Errorf("failed to delete message index: %v", err)
        }
    }

    return nil
}


func (db *BigtableDB) GetMessageIndex(ctx context.Context, messageID types.MessageID) (bool, error) {
	tableName := MessageIndexTableName

	rowKey := string(messageID)

	table := db.client.Open(tableName)
	row, err := table.ReadRow(ctx, rowKey)
	if err != nil {
		return false, fmt.Errorf("failed to read message index: %v", err)
	}

	return len(row) > 0, nil
}

// TODO: depending on the size of the data, we might want to consider batching the reads
func (db *BigtableDB) GetAllMessageIndexes(ctx context.Context) ([]types.MessageID, error) {
	tableName := MessageIndexTableName

	var messageIndexes []types.MessageID
	err := db.client.Open(tableName).ReadRows(ctx, bigtable.InfiniteRange(""), func(row bigtable.Row) bool {
		messageIndexes = append(messageIndexes, types.MessageID(row.Key()))
		return true
	})

	if err != nil {
		return nil, fmt.Errorf("failed to get message indexes: %v", err)
	}

	return messageIndexes, nil
}
