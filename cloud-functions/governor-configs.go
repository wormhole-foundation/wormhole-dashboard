package cloud_functions

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"google.golang.org/api/iterator"
)

var configsCache Cache

type GovernorConfigsResponse struct {
	GovernorConfigs []map[string]interface{} `json:"governorConfigs"`
}

func GovernorConfigs(w http.ResponseWriter, r *http.Request) {
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
	var configs []map[string]interface{}
	if now.Before(configsCache.ttl) {
		configs = configsCache.data
		log.Println("using cached data")
	} else {
		ctx := context.Background()
		iter := client.Collection("governorConfigs").Documents(ctx)
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				log.Fatalf("%v\n", err)
			}
			configs = append(configs, doc.Data())
		}
		configsCache.data = configs
		configsCache.ttl = now.Add(cacheTtlDuration)
		log.Println("refreshed cache")
	}

	response := GovernorConfigsResponse{
		GovernorConfigs: configs,
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
