package bigtable

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
	"github.com/wormhole-foundation/wormhole-monitor/fly/utils"
)

// To test files: go test -v pkg/bigtable/message_test.go pkg/bigtable/message.go pkg/bigtable/message_index.go pkg/bigtable/test_setup.go pkg/bigtable/observation.go
var db *BigtableDB

// Note that this test file assumes that the Bigtable emulator is running locally.
// Before we start the test, we create the relevant tables in the emulator.
// After the test, we delete the tables.
func TestMain(m *testing.M) {
	// Set up the Bigtable emulator
	err := SetupEmulator()
	if err != nil {
		fmt.Printf("Failed to set up the emulator: %v\n", err)
		os.Exit(1)
	}

	// Create a Bigtable client
	ctx := context.Background()
	db, err = NewBigtableDB(ctx, ProjectID, InstanceID, "", EmulatorHost, true)
	if err != nil {
		fmt.Printf("Failed to create Bigtable client: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Run the tests
	exitCode := m.Run()
	err = CleanUp()
	if err != nil {
		fmt.Printf("Failed to cleanup the Bigtable client: %v\n", err)
	}
	os.Exit(exitCode)
}

func TestCreateMessageAndIndex(t *testing.T) {
	ctx := context.Background()
	defer ClearTables()

	messageID := utils.GenerateRandomID()

	message := &types.Message{
		MessageID:      types.MessageID(messageID),
		LastObservedAt: time.Now(),
		MetricsChecked: true,
	}

	err := db.CreateMessageAndMessageIndex(ctx, message)
	assert.NoError(t, err)

	msg, err := db.GetMessage(ctx, types.MessageID(messageID))
	assert.NoError(t, err)
	assert.NotNil(t, msg)
	assert.Equal(t, message.MessageID, msg.MessageID)
	assert.Equal(t, message.LastObservedAt.Unix(), msg.LastObservedAt.Unix())
	assert.Equal(t, message.MetricsChecked, msg.MetricsChecked)

	// Verify that the message index is saved as well for this messageID
	table := db.client.Open(MessageIndexTableName)
	row, err := table.ReadRow(ctx, messageID)
	assert.NoError(t, err)
	assert.NotNil(t, row)
}

func TestUpdateMessage(t *testing.T) {
	ctx := context.Background()
	defer ClearTables()

	messageID := utils.GenerateRandomID()
	message := &types.Message{
		MessageID:      types.MessageID(messageID),
		LastObservedAt: time.Now(),
		MetricsChecked: false,
	}

	err := db.CreateMessageAndMessageIndex(ctx, message)
	assert.NoError(t, err)

	// Update the message
	message.LastObservedAt = time.Now().Add(1 * time.Hour)
	message.MetricsChecked = true
	err = db.CreateMessageAndMessageIndex(ctx, message)
	assert.NoError(t, err)

	// Verify that the message has the updated fields
	msg, err := db.GetMessage(ctx, types.MessageID(messageID))
	assert.NoError(t, err)
	assert.NotNil(t, msg)
	assert.True(t, message.LastObservedAt.UTC().Equal(msg.LastObservedAt.UTC()))
	assert.True(t, msg.MetricsChecked)
}

func TestGetMessage(t *testing.T) {
	ctx := context.Background()
	defer ClearTables()

	messageID := utils.GenerateRandomID()

	// Create a sample message
	message := &types.Message{
		MessageID:      types.MessageID(messageID),
		LastObservedAt: time.Now(),
		MetricsChecked: true,
	}
	err := db.CreateMessageAndMessageIndex(ctx, message)
	assert.NoError(t, err)

	retrievedMessage, err := db.GetMessage(ctx, types.MessageID(messageID))
	assert.NoError(t, err)
	assert.NotNil(t, retrievedMessage)
	assert.Equal(t, message.MessageID, retrievedMessage.MessageID)
	assert.True(t, message.LastObservedAt.UTC().Equal(retrievedMessage.LastObservedAt))
	assert.Equal(t, message.MetricsChecked, retrievedMessage.MetricsChecked)
}

func TestDeleteMessageIndex(t *testing.T) {
	ctx := context.Background()
	defer ClearTables()

	messageID := utils.GenerateRandomID()
	// Create a sample message
	message := &types.Message{
		MessageID:      types.MessageID(messageID),
		LastObservedAt: time.Now(),
		MetricsChecked: true,
	}
	err := db.CreateMessageAndMessageIndex(ctx, message)
	assert.NoError(t, err)

	err = db.DeleteMessageIndex(ctx, types.MessageID(messageID))
	assert.NoError(t, err)

	// Verify that the deleted message index is not in the table
	table := db.client.Open(MessageIndexTableName)
	row, err := table.ReadRow(ctx, messageID)
	assert.Nil(t, err)
	assert.Nil(t, row)
}

func TestSaveObservationAndUpdateMessage(t *testing.T) {
	tests := []struct {
		name                        string
		observations                []types.Observation
		expectedLastObservedAtIndex int
	}{
		{
			name: "Same guardian, no updates",
			observations: []types.Observation{
				{
					MessageID:    "message1",
					GuardianAddr: "guardian1",
					Status:       1,
					ObservedAt:   time.Now(),
				},
				{
					MessageID:    "message1",
					GuardianAddr: "guardian1",
					Status:       1,
					ObservedAt:   time.Now().Add(1 * time.Hour),
				},
			},
			// The last observed time should be the same as the initial observation
			// Since the second observation is the same, it should not be accounted for
			expectedLastObservedAtIndex: 0,
		},
		{
			name: "Different guardians, new observations",
			observations: []types.Observation{
				{
					// Initial observation for guardian1
					MessageID:    "message1",
					GuardianAddr: "guardian1",
					Status:       1,
					ObservedAt:   time.Now(),
				},
				{
					// New observation for guardian2
					MessageID:    "message1",
					GuardianAddr: "guardian2",
					Status:       1,
					ObservedAt:   time.Now().Add(1 * time.Hour),
				},
			},
			// We want to verify that the last observed time is the time of the last observation
			// Since the second observation is for a different guardian, it should be accounted for
			expectedLastObservedAtIndex: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			defer ClearTables()

			signature := utils.GenerateRandomID()
			for _, obs := range tc.observations {
				obs.Signature = signature

				err := db.SaveObservationAndUpdateMessage(ctx, &obs)
				assert.NoError(t, err)
			}

			// Verify the updated message with the last observation
			lastObservation := tc.observations[tc.expectedLastObservedAtIndex]
			message, err := db.GetMessage(ctx, types.MessageID("message1"))
			assert.NoError(t, err)
			assert.NotNil(t, message)
			assert.True(t, message.LastObservedAt.UTC().Equal(lastObservation.ObservedAt.UTC()))
		})
	}
}

func TestGetUnprocessedMessagesBeforeCutOffTime(t *testing.T) {
	// Create a Bigtable client
	ctx := context.Background()
	defer ClearTables()

	messageIDSet := make(map[string]struct{})
	for i := 0; i < 10; i++ {
		messageID := utils.GenerateRandomID()
		guardianAddr := fmt.Sprintf("guardian%d", i)
		signature := utils.GenerateRandomID()

		observation := &types.Observation{
			MessageID:    types.MessageID(messageID),
			GuardianAddr: guardianAddr,
			Signature:    signature,
			ObservedAt:   time.Now(),
			Status:       1,
		}
		err := db.SaveObservationAndUpdateMessage(ctx, observation)
		assert.NoError(t, err)

		messageIDSet[messageID] = struct{}{}
	}

	// Verify that the message indexes are saved
	messageIndexes, err := db.GetAllMessageIndexes(ctx)
	assert.NoError(t, err)
	assert.Len(t, messageIndexes, 10)

	messages, err := db.GetUnprocessedMessagesBeforeCutOffTime(ctx, time.Now())
	assert.NoError(t, err)
	assert.Len(t, messages, 10)

	// Verify that the messages are the same as the ones saved
	for _, message := range messages {
		_, ok := messageIDSet[string(message.MessageID)]
		assert.Equal(t, ok, true)
	}

	// Verify that the message indexes are deleted
	messageIndexes, err = db.GetAllMessageIndexes(ctx)
	assert.NoError(t, err)
	assert.Len(t, messageIndexes, 0)
}
