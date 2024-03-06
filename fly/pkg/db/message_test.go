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

	// Store the time for consistent comparison
	observedTime := time.Now().Add(-30 * time.Hour)

	// Create messages
	message0 := getMessage(0, observedTime, false)
	err := db.SaveMessage(message0)
	require.NoError(t, err)

	message1 := getMessage(1, observedTime, true)
	err = db.SaveMessage(message1)
	require.NoError(t, err)

	message2 := getMessage(2, time.Now().Add(-10*time.Hour), false)
	err = db.SaveMessage(message2)
	require.NoError(t, err)

	// Query messages
	result, err := db.QueryMessagesByIndex(false, 30*time.Hour)
	require.NoError(t, err)
	require.Len(t, result, 1, "expected 1 message")

	// Check if the message0 is in the result
	require.Equal(t, message0.MessageID, result[0].MessageID)
	require.True(t, observedTime.Equal(result[0].LastObservedAt), "message0 should be found in the result set")
}

func TestRemoveObservationsByIndex(t *testing.T) {
	db := OpenDb(zap.NewNop(), nil)
	defer db.db.Close()

	testCases := []struct {
		messageID       int
		timeOffset      time.Duration
		metricsChecked  bool
		expectEmpty     bool
	}{
		{0, -49 * time.Hour, true, true},
		{1, -40 * time.Hour, true, false},
		{2, -50 * time.Hour, false, false},
		{3, -72 * time.Hour, true, true},
		{4, -96 * time.Hour, true, true},
	}

	for _, tc := range testCases {
		message := getMessage(tc.messageID, time.Now().Add(tc.timeOffset), tc.metricsChecked)
		err := db.SaveMessage(message)
		require.NoError(t, err)
	}

	err := db.RemoveMessagesByIndex(true, 48*time.Hour)
	require.NoError(t, err)

	for _, tc := range testCases {
		_, err := db.GetMessage(fmt.Sprintf("messageId%d", tc.messageID))
		// err should return message not found
		if tc.expectEmpty {
			require.ErrorIs(t, err, ErrMessageNotFound)
		} else {
			require.NoError(t, err)
		}
	}
}
