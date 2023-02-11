package main

import (
	"context"
	"log"
	"net/http"
	"os"

	p "github.com/wormhole-foundation/example-fly-firestore/cloud-functions"

	"github.com/GoogleCloudPlatform/functions-framework-go/funcframework"
)

var mux = newMux()

// Entry is the cloud function entry point
func Entry(w http.ResponseWriter, r *http.Request) {
	mux.ServeHTTP(w, r)
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/guardian-heartbeats", p.Heartbeats)
	mux.HandleFunc("/governor-status", p.GovernorStatus)
	mux.HandleFunc("/governor-configs", p.GovernorConfigs)
	return mux
}

func main() {
	ctx := context.Background()
	if err := funcframework.RegisterHTTPFunctionContext(ctx, "/", Entry); err != nil {
		log.Fatalf("funcframework.RegisterHTTPFunctionContext: %v\n", err)
	}
	// Use PORT environment variable, or default to 8080.
	port := "8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}
	if err := funcframework.Start(port); err != nil {
		log.Fatalf("funcframework.Start: %v\n", err)
	}
}
