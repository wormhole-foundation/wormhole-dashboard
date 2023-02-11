package cloud_functions

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"google.golang.org/api/iterator"
)

var statusCache Cache

type GovernorStatusResponse struct {
	GovernorStatus []map[string]interface{} `json:"governorStatus"`
}

func GovernorStatus(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers for the preflight request
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Max-Age", "3600")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	// Set CORS headers for the main request.
	w.Header().Set("Access-Control-Allow-Origin", "*")

	now := time.Now()
	var status []map[string]interface{}
	if now.Before(statusCache.ttl) {
		status = statusCache.data
		log.Println("using cached data")
	} else {
		ctx := context.Background()
		iter := client.Collection("governorStatus").Documents(ctx)
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				log.Fatalf("%v\n", err)
			}
			status = append(status, doc.Data())
		}
		statusCache.data = status
		statusCache.ttl = now.Add(cacheTtlDuration)
		log.Println("refreshed cache")
	}

	response := GovernorStatusResponse{
		GovernorStatus: status,
	}
	jsonBytes, err := json.Marshal(response)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(err.Error()))
		log.Println(err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write(jsonBytes)
}
