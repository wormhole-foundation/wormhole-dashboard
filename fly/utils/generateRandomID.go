package utils

import (
	"crypto/rand"
	"encoding/hex"
)

func GenerateRandomID() string {
	b := make([]byte, 8) // Generates a 16-character hex string
	_, err := rand.Read(b)
	if err != nil {
		panic("failed to generate random ID: " + err.Error())
	}
	return hex.EncodeToString(b)
}
