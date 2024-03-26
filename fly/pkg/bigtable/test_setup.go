package bigtable

import (
	"context"
	"fmt"
	"os"

	"cloud.google.com/go/bigtable"
)

const (
	ProjectID    = "test-project"
	InstanceID   = "test-instance"
	EmulatorHost = "localhost:8086"
)

// SetupEmulator sets up the Bigtable emulator and creates the necessary tables.
func SetupEmulator() error {
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

	fmt.Println("Tables created successfully")

	return nil
}

func CleanUp() error {
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

func ClearTables() error {
	adminClient, err := bigtable.NewAdminClient(context.Background(), ProjectID, InstanceID)
	if err != nil {
		return fmt.Errorf("failed to create admin client: %v", err)
	}
	defer adminClient.Close()

	tables := []string{MessageTableName, MessageIndexTableName, ObservationTableName}
	for _, table := range tables {
		err := adminClient.DropAllRows(context.Background(), table)
		if err != nil {
			return fmt.Errorf("failed to drop all rows in table %q: %v", table, err)
		}
	}

	return nil
}
