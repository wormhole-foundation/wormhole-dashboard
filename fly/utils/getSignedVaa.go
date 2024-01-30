package utils

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/wormhole-foundation/wormhole/sdk/vaa"
)

var GUARDIAN_RPC_HOSTS = []string{
	"https://api.wormholescan.io",
	"https://wormhole-v2-mainnet-api.mcf.rocks",
	"https://wormhole-v2-mainnet-api.chainlayer.network",
	"https://wormhole-v2-mainnet-api.staking.fund",
}

// ObservationData represents the structure of each observation in the response.
type ObservationData struct {
	Sequence     uint64 `json:"sequence"`
	ID           string `json:"id"`
	EmitterChain uint   `json:"emitterChain"`
	EmitterAddr  string `json:"emitterAddr"`
	Hash         string `json:"hash"`
	TxHash       string `json:"txHash"`
	GuardianAddr string `json:"guardianAddr"`
	Signature    string `json:"signature"`
	UpdatedAt    string `json:"updatedAt"`
	IndexedAt    string `json:"indexedAt"`
}

func GetObservationsByMessageId(chain vaa.ChainID, emitterAddress vaa.Address, sequence uint64) ([]ObservationData, error) {
	url := fmt.Sprintf("https://api.wormscan.io/api/v1/observations/%d/%s/%d", chain, emitterAddress.String(), sequence)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err // Try the next host
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		var signedVAAs []ObservationData
		err = json.Unmarshal(body, &signedVAAs)
		if err != nil {
			return nil, err
		}

		return signedVAAs, nil
	}

	return nil, fmt.Errorf("failed to fetch signed VAA from any guardian")
}
