package bigtable

import (
	"context"

	"fmt"
	"os"
	"testing"
	"time"

	"cloud.google.com/go/bigtable"
	"github.com/stretchr/testify/assert"
	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/historical_uptime"
)

const (
	ProjectID    = "test-project"
	InstanceID   = "test-instance"
	EmulatorHost = "localhost:8086"
)

var db *BigtableDB

// Note that this test file assumes that the Bigtable emulator is running locally.
// Before we start the test, we create the relevant tables in the emulator.
// After the test, we delete the tables.
func TestMain(m *testing.M) {
	// Set up the Bigtable emulator
	err := setupEmulator()
	if err != nil {
		fmt.Printf("Failed to set up the emulator: %v\n", err)
		os.Exit(1)
	}

	// Create a Bigtable client
	ctx := context.Background()
	db, err = NewBigtableDB(ctx, ProjectID, InstanceID, "", EmulatorHost)
	if err != nil {
		fmt.Printf("Failed to create Bigtable client: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Run the tests
	exitCode := m.Run()
	err = cleanUp()
	if err != nil {
		fmt.Printf("Failed to cleanup the Bigtable client: %v\n", err)
	}
	os.Exit(exitCode)
}

// setupEmulator sets up the Bigtable emulator and creates the necessary tables.
func setupEmulator() error {
	// Set the environment variable for the emulator host
	os.Setenv("BIGTABLE_EMULATOR_HOST", EmulatorHost)

	adminClient, err := bigtable.NewAdminClient(context.Background(), ProjectID, InstanceID)
	if err != nil {
		return fmt.Errorf("failed to create admin client: %v", err)
	}
	defer adminClient.Close()

	tables := []struct {
		name           string
		columnFamilies []string
	}{
		{name: MessageTableName, columnFamilies: []string{"messageData"}},
		{name: MessageIndexTableName, columnFamilies: []string{"indexData"}},
		{name: ObservationTableName, columnFamilies: []string{"observationData"}},
	}
	for _, table := range tables {
		tableInfo, err := adminClient.TableInfo(context.Background(), table.name)
		if err == nil {
			fmt.Printf("Table %q already exists: %v\n", table, tableInfo)
			continue
		}
		if err := adminClient.CreateTable(context.Background(), table.name); err != nil {
			return fmt.Errorf("failed to create table %q: %v", table, err)
		}
		for _, family := range table.columnFamilies {
			if err := adminClient.CreateColumnFamily(context.Background(), table.name, family); err != nil {
				return fmt.Errorf("failed to create column family %q in table %q: %v", family, table.name, err)
			}
		}
	}

	return nil
}

func cleanUp() error {
	adminClient, err := bigtable.NewAdminClient(context.Background(), ProjectID, InstanceID)
	if err != nil {
		return fmt.Errorf("failed to create admin client: %v", err)
	}
	defer adminClient.Close()

	adminClient.DeleteTable(context.Background(), MessageTableName)
	adminClient.DeleteTable(context.Background(), MessageIndexTableName)
	adminClient.DeleteTable(context.Background(), ObservationTableName)

	return nil
}

func TestSaveMessage(t *testing.T) {
	ctx := context.Background()
	db, err := NewBigtableDB(ctx, ProjectID, InstanceID, "", EmulatorHost)
	assert.NoError(t, err)
	defer db.Close()

	messageID := historical_uptime.GenerateRandomID()

	message := &Message{
		MessageID:      MessageID(messageID),
		LastObservedAt: time.Now(),
		MetricsChecked: true,
	}

	err = db.SaveMessage(ctx, message)
	assert.NoError(t, err)

	table := db.client.Open(MessageTableName)
	row, err := table.ReadRow(ctx, messageID)
	assert.NoError(t, err)
	assert.NotNil(t, row)

	// Verify the message index
	table = db.client.Open(MessageIndexTableName)
	row, err = table.ReadRow(ctx, messageID)
	assert.NoError(t, err)
	assert.NotNil(t, row)
}

func TestGetMessage(t *testing.T) {
	ctx := context.Background()
	db, err := NewBigtableDB(ctx, ProjectID, InstanceID, "", EmulatorHost)
	assert.NoError(t, err)
	defer db.Close()

	messageID := historical_uptime.GenerateRandomID()

	// Create a sample message
	message := &Message{
		MessageID:      MessageID(messageID),
		LastObservedAt: time.Now(),
		MetricsChecked: true,
	}
	err = db.SaveMessage(ctx, message)
	assert.NoError(t, err)

	retrievedMessage, err := db.GetMessage(ctx, MessageID(messageID))
	assert.NoError(t, err)
	assert.NotNil(t, retrievedMessage)
	assert.Equal(t, message.MessageID, retrievedMessage.MessageID)
	assert.Equal(t, message.LastObservedAt.Unix(), retrievedMessage.LastObservedAt.Unix())
	assert.Equal(t, message.MetricsChecked, retrievedMessage.MetricsChecked)
}

func TestDeleteMessageIndex(t *testing.T) {
	ctx := context.Background()
	db, err := NewBigtableDB(ctx, ProjectID, InstanceID, "", EmulatorHost)
	assert.NoError(t, err)
	defer db.Close()

	messageID := historical_uptime.GenerateRandomID()
	// Create a sample message
	message := &Message{
		MessageID:      MessageID(messageID),
		LastObservedAt: time.Now(),
		MetricsChecked: true,
	}
	err = db.SaveMessage(ctx, message)
	assert.NoError(t, err)

	err = db.DeleteMessageIndex(ctx, MessageID(messageID))
	assert.NoError(t, err)

	// Verify the deleted message index
	table := db.client.Open(MessageIndexTableName)
	row, err := table.ReadRow(ctx, messageID)
	assert.Nil(t, err)
	assert.Nil(t, row)
}

func TestSaveObservationAndUpdateMessage(t *testing.T) {
	// Create a Bigtable client
	ctx := context.Background()
	db, err := NewBigtableDB(ctx, ProjectID, InstanceID, "", EmulatorHost)
	assert.NoError(t, err)
	defer db.Close()

	messageID := historical_uptime.GenerateRandomID()
	guardianAddr := "guardian1"
	signature := historical_uptime.GenerateRandomID()

	observation := &Observation{
		MessageID:    MessageID(messageID),
		GuardianAddr: guardianAddr,
		Signature:    signature,
		ObservedAt:   time.Now(),
		Status:       1,
	}

	err = db.SaveObservationAndUpdateMessage(ctx, observation)
	assert.NoError(t, err)

	// Verify the saved observation
	observationTable := db.client.Open(ObservationTableName)
	observationRow, err := observationTable.ReadRow(ctx, messageID+"_"+guardianAddr)
	assert.NoError(t, err)
	assert.NotNil(t, observationRow)

	// Verify the updated message
	messageTable := db.client.Open(MessageTableName)
	messageRow, err := messageTable.ReadRow(ctx, messageID)
	assert.NoError(t, err)
	assert.NotNil(t, messageRow)

	// Simulate if the same observation comes in again
	observation.ObservedAt = time.Now()
	err = db.SaveObservationAndUpdateMessage(ctx, observation)
	assert.NoError(t, err)

	// Verify that the observation is not saved again
	savedObservation, err := db.GetObservation(ctx, messageID, guardianAddr)
	assert.NoError(t, err)
	assert.NotNil(t, savedObservation)
	assert.Equal(t, observation.ObservedAt.Unix(), savedObservation.ObservedAt.Unix())
}
