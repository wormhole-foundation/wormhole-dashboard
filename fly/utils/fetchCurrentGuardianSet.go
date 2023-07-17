package utils

import (
	"context"
	"fmt"
	"time"

	"github.com/certusone/wormhole/node/pkg/watchers/evm/connectors/ethabi"
	ethAbi "github.com/certusone/wormhole/node/pkg/watchers/evm/connectors/ethabi"
	ethBind "github.com/ethereum/go-ethereum/accounts/abi/bind"
	eth_common "github.com/ethereum/go-ethereum/common"
	ethClient "github.com/ethereum/go-ethereum/ethclient"
	ethRpc "github.com/ethereum/go-ethereum/rpc"
)

// Fetch the current guardian set ID and guardian set from the chain.
// I would have used NewEthereumConnector from
// https://github.com/wormhole-foundation/wormhole/blob/main/node/pkg/watchers/evm/connectors/ethereum.go
// but I didn't want to deal with the celo vs eth multiple definition ld issue
func FetchCurrentGuardianSet(rpcUrl, contractAddress string) (uint32, *ethabi.StructsGuardianSet, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()

	contract := eth_common.HexToAddress(contractAddress)
	rawClient, err := ethRpc.DialContext(ctx, rpcUrl)
	if err != nil {
		return 0, nil, fmt.Errorf("failed to connect to ethereum")
	}
	client := ethClient.NewClient(rawClient)
	caller, err := ethAbi.NewAbiCaller(contract, client)
	if err != nil {
		return 0, nil, fmt.Errorf("failed to create caller")
	}
	currentIndex, err := caller.GetCurrentGuardianSetIndex(&ethBind.CallOpts{Context: ctx})
	if err != nil {
		return 0, nil, fmt.Errorf("error requesting current guardian set index: %w", err)
	}

	gs, err := caller.GetGuardianSet(&ethBind.CallOpts{Context: ctx}, currentIndex)
	if err != nil {
		return 0, nil, fmt.Errorf("error requesting current guardian set value: %w", err)
	}

	return currentIndex, &gs, nil
}
