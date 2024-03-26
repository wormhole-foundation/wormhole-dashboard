package types

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/wormhole-foundation/wormhole/sdk/vaa"
)
// GuardianObservation represents an observation made by a guardian.
type Observation struct {
	MessageID    MessageID         `json:"messageId"`
	GuardianAddr string            `json:"guardianAddr"`
	Signature    string            `json:"signature"`
	ObservedAt   time.Time         `json:"observedAt"`
	Status       ObservationStatus `json:"status"`
}

type ObservationStatus int

const (
	OnTime ObservationStatus = iota
	// Late indicates that the observation was made 30 hours after the last observed timestamp
	Late
)

// Message represents the data structure for a message in the Observations table.
type Message struct {
	MessageID      MessageID `json:"messageId"`
	LastObservedAt time.Time `json:"lastObservedAt"`
	MetricsChecked bool      `json:"metricsChecked"`
}

type MessageID string

func (m MessageID) ChainID() (string, error) {
	// Parse the MessageID and return only the EmitterChain as a string
	parts := strings.Split(string(m), "/")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid MessageID format: %s", string(m))
	}
	emitterChain, err := strconv.Atoi(parts[0])
	if err != nil {
		return "", fmt.Errorf("failed to parse emitter chain from MessageID: %s, error: %v", string(m), err)
	}
	return vaa.ChainID(emitterChain).String(), nil
}
