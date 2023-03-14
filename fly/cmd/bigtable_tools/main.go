package main

import (
	"context"

	"flag"

	"log"

	"cloud.google.com/go/bigtable"
	//"github.com/wormhole-foundation/wormhole/sdk/vaa"
)

// Example usage:
// GOOGLE_APPLICATION_CREDENTIALS=~/bigtable-admin.json go run main.go -project "wormhole-315720" -instance "wormhole-mainnet"

func main() {
	project := flag.String("project", "", "The Google Cloud Platform project ID. Required.")
	instance := flag.String("instance", "", "The Google Cloud Bigtable instance ID. Required.")
	prefix := flag.String("prefix", "", "Bigtable row prefix. Default is empty string.")
	flag.Parse()
	for _, f := range []string{"project", "instance"} {
		if flag.Lookup(f).Value.String() == "" {
			log.Fatalf("The %s flag is required.", f)
		}
	}
	ctx := context.Background()
	client, err := bigtable.NewClient(ctx, *project, *instance)
	if err != nil {
		log.Fatalf("Could not create client: %v", err)
	}
	defer client.Close()
	tbl := client.Open("signedVAAs")
	log.Printf("Reading all signedVAAs rows:")
	err = tbl.ReadRows(ctx, bigtable.PrefixRange(*prefix), func(row bigtable.Row) bool {
		// item := row["info"][0]
		// v, err := vaa.Unmarshal(item.Value)
		// if err != nil {
		// log.Printf("Error unmarshalling VAA: %v\n", err)
		// return true
		// }
		log.Println(row.Key())
		return true
	}, bigtable.RowFilter(bigtable.ColumnFilter("bytes")))
	if err != nil {
		log.Fatalf("Error reading rows: %v", err)
	}
}
