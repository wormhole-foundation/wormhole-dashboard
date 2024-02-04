package db

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func getMessage(id int, observedAt time.Time, metricsChecked bool) *Message {
	return &Message{
		MessageID:      MessageID(fmt.Sprintf("messageId%d", id)),
		LastObservedAt: observedAt,
		Observations: []Observation{
			{
				GuardianAddr: "guardianId",
				Signature:    "signature",
				ObservedAt:   observedAt,
			},
		},
		MetricsChecked: metricsChecked,
	}
}

func TestCreateMessage(t *testing.T) {
	db := OpenDb(zap.NewNop(), nil)
	defer db.db.Close()

	// Create a message
	message := getMessage(0, time.Now(), false)
	err := db.SaveMessage(message)
	require.NoError(t, err)
}

func TestGetMessage(t *testing.T) {
	db := OpenDb(zap.NewNop(), nil)
	defer db.db.Close()

	// Create a message
	message := getMessage(0, time.Now(), false)
	err := db.SaveMessage(message)
	require.NoError(t, err)

	// Retrieve a non-existent message from the database
	messageFromDb, err := db.GetMessage("messageId0")
	require.NoError(t, err)

	require.Equal(t, message.MessageID, messageFromDb.MessageID)
}

func TestGetMessageNotFound(t *testing.T) {
	db := OpenDb(zap.NewNop(), nil)
	defer db.db.Close()

	// Retrieve a non-existent message from the database
	_, err := db.GetMessage("messageId")
	require.ErrorIs(t, err, ErrMessageNotFound)
}

func TestQueryMessagesByIndex(t *testing.T) {
	db := OpenDb(zap.NewNop(), nil)
	defer db.db.Close()

	// Create a message with LastObservedAt set to 30 hours ago
	message0 := getMessage(0, time.Now().Add(-30*time.Hour), false)
	err := db.SaveMessage(message0)
	require.NoError(t, err)

	// Create a message with LastObservedAt set to 30 hours ago but with metrics checked
	message1 := getMessage(1, time.Now().Add(-30*time.Hour), true)
	err = db.SaveMessage(message1)
	require.NoError(t, err)

	// Create a message with LastObservedAt set to 10 hours ago
	message2 := getMessage(2, time.Now().Add(-10*time.Hour), false)
	err = db.SaveMessage(message2)
	require.NoError(t, err)

	result, err := db.QueryMessagesByIndex(false, 30*time.Hour)
	require.NoError(t, err)

	length := len(result)
	require.Equal(t, 1, length, "expected 1 message")

	found := false
	for _, msg := range result {
		if msg.MessageID == message0.MessageID && msg.LastObservedAt.Equal(message0.LastObservedAt) && msg.MetricsChecked == true {
			found = true
			break
		}
	}
	require.True(t, found, "message found in the result set")
}
