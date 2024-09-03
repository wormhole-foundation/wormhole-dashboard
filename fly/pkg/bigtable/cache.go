// Package bigtable provides a cache implementation for storing and retrieving messages and observations.
package bigtable

import (
	"sync"

	"github.com/wormhole-foundation/wormhole-monitor/fly/pkg/types"
)

// ObservationCache is a thread-safe cache for storing messages and observations.
type ObservationCache struct {
	Messages     map[types.MessageID]*types.Message                // Stores messages indexed by their ID
	Observations map[types.MessageID]map[string]*types.Observation // Stores observations indexed by message ID and guardian address
	mu           sync.RWMutex                                      // Mutex for ensuring thread-safety
}

// Lock acquires a write lock on the cache.
func (c *ObservationCache) Lock() {
	c.mu.Lock()
}

// Unlock releases the write lock on the cache.
func (c *ObservationCache) Unlock() {
	c.mu.Unlock()
}

// RLock acquires a read lock on the cache.
func (c *ObservationCache) RLock() {
	c.mu.RLock()
}

// RUnlock releases the read lock on the cache.
func (c *ObservationCache) RUnlock() {
	c.mu.RUnlock()
}

// GetMessage retrieves a message from the cache by its ID.
// It returns the message and a boolean indicating whether the message was found.
func (c *ObservationCache) GetMessage(messageID types.MessageID) (*types.Message, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	message, exists := c.Messages[messageID]
	return message, exists
}

// SetMessage adds or updates a message in the cache.
func (c *ObservationCache) SetMessage(messageID types.MessageID, message *types.Message) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Messages[messageID] = message
}

// GetObservation retrieves an observation from the cache by message ID and guardian address.
// It returns the observation and a boolean indicating whether the observation was found.
func (c *ObservationCache) GetObservation(messageID types.MessageID, guardianAddr string) (*types.Observation, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if observations, exists := c.Observations[messageID]; exists {
		observation, exists := observations[guardianAddr]
		return observation, exists
	}
	return nil, false
}

// SetObservation adds or updates an observation in the cache.
func (c *ObservationCache) SetObservation(messageID types.MessageID, guardianAddr string, observation *types.Observation) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, exists := c.Observations[messageID]; !exists {
		c.Observations[messageID] = make(map[string]*types.Observation)
	}
	c.Observations[messageID][guardianAddr] = observation
}
