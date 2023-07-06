package main

import (
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"go.uber.org/zap"
)

// Embed the DefaultFly for ez impl
type MyCoolFly struct{ DefaultFly }

func (mcf *MyCoolFly) HandleObservation(obs *gossipv1.SignedObservation) {
	mcf.logger.Info("Got one", zap.String("id", obs.MessageId))
}

func main() {
	Launch(&MyCoolFly{})
}
