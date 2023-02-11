package cloud_functions

import (
	"context"
	"log"
	"os"
	"time"

	firestore "cloud.google.com/go/firestore"
	firebase "firebase.google.com/go"
)

type Cache struct {
	data []map[string]interface{}
	ttl  time.Time
}

var cacheTtlDuration time.Duration

// client is in the global (instance-wide) scope.
var client *firestore.Client

// init runs during package initialization. So, this will only run during an
// an instance's cold start.
func init() {
	ctx := context.Background()
	projectID := os.Getenv("GCP_PROJECT")
	if projectID == "" {
		log.Fatalln("GCP_PROJECT must be specified")
	}
	conf := &firebase.Config{ProjectID: projectID}
	app, err := firebase.NewApp(ctx, conf)
	if err != nil {
		log.Fatalln(err)
	}
	client, err = app.Firestore(ctx)
	if err != nil {
		log.Fatalln(err)
	}
	cacheTtlDuration = 15 * time.Second
}
