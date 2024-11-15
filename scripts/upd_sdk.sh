#!/bin/bash

if [ $# != 1 ]
  then
    echo "Usage: $0 1.1.1"
    exit 1
fi

version=$1
echo "Version: $version"

echo "Updating package.json ============================================================================="
npm i @wormhole-foundation/sdk-base@$version
npm i @wormhole-foundation/sdk-definitions@$version
npm i @wormhole-foundation/sdk-evm@$version
npm i @wormhole-foundation/sdk-evm-core@$version
npm i @wormhole-foundation/sdk-icons@$version
npm i @wormhole-foundation/sdk-solana@$version
npm i @wormhole-foundation/sdk-solana-core@$version

cd dashboard
echo "Updating dashboard/package.json ==================================================================="
npm i @wormhole-foundation/sdk-icons@$version

cd ../database
echo "Updating database/package.json ==================================================================="
npm i @wormhole-foundation/sdk@$version
