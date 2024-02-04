package common

import (
	"time"
)

const (
	ExpiryDuration = 30 * time.Hour
	DatabaseCleanUpInterval = 48 * time.Hour

	MessageUpdateBatchSize = 100
)
