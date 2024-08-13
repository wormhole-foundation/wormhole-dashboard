#!/bin/bash
source .env
set -e

if [[ $0 != "cloud_functions/scripts/deploy.sh" ]]; then
  echo "This script should be run from the root via \"npm run cf:deploy\""
  exit 1
fi

# Install and authorize the gcloud CLI: https://cloud.google.com/sdk/docs/install

# SET ENV VARIABLES
# export env variables required below
# or source .env
# make sure you npm run build in the root folder before trying to deploy :D

# Need to set NETWORK to either MAINNET or TESTNET
if [ -z "$NETWORK" ]; then
    echo "NETWORK must be specified"
    exit 1
fi
if [ "$NETWORK" != "MAINNET" ] && [ "$NETWORK" != "TESTNET" ]; then
    echo "Invalid NETWORK specified"
    exit 1
fi

# This specifies the mainnet or testnet project
if [ -z "$GCP_PROJECT" ]; then
    echo "GCP_PROJECT must be specified"
    exit 1
fi

#
# These are required for both MAINNET and TESTNET
#
if [ -z "$BIGTABLE_INSTANCE_ID" ]; then
    echo "BIGTABLE_INSTANCE_ID must be specified"
    exit 1
fi

if [ -z "$BIGTABLE_TABLE_ID" ]; then
    echo "BIGTABLE_TABLE_ID must be specified"
    exit 1
fi

if [ -z "$BIGTABLE_SIGNED_VAAS_TABLE_ID" ]; then
    echo "BIGTABLE_SIGNED_VAAS_TABLE_ID must be specified"
    exit 1
fi

if [ -z "$BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID" ]; then
    echo "BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID must be specified"
    exit 1
fi

if [ -z "$CLOUD_FUNCTIONS_NUM_ROWS" ]; then
    echo "CLOUD_FUNCTIONS_NUM_ROWS must be specified"
    exit 1
fi

if [ -z "$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL" ]; then
    echo "CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL be specified"
    exit 1
fi

if [ -z "$CLOUD_FUNCTIONS_BLOCK_INCREMENT" ]; then
    echo "CLOUD_FUNCTIONS_BLOCK_INCREMENT must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_LATEST_COLLECTION" ]; then
    echo "FIRESTORE_LATEST_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_TVL_COLLECTION" ]; then
    echo "FIRESTORE_TVL_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_TVL_HISTORY_COLLECTION" ]; then
    echo "FIRESTORE_TVL_HISTORY_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION" ]; then
    echo "FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_ALARM_MISSING_VAAS_COLLECTION" ]; then
    echo "FIRESTORE_ALARM_MISSING_VAAS_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_LATEST_TVLTVM_COLLECTION" ]; then
    echo "FIRESTORE_LATEST_TVLTVM_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_GUARDIAN_SET_INFO_COLLECTION" ]; then
    echo "FIRESTORE_GUARDIAN_SET_INFO_COLLECTION must be specified"
    exit 1
fi

if [ -z "$MISSING_VAA_SLACK_CHANNEL_ID" ]; then
    echo "MISSING_VAA_SLACK_CHANNEL_ID must be specified"
    exit 1
fi

if [ -z "$MISSING_VAA_SLACK_POST_URL" ]; then
    echo "MISSING_VAA_SLACK_POST_URL must be specified"
    exit 1
fi

if [ -z "$MISSING_VAA_SLACK_BOT_TOKEN" ]; then
    echo "MISSING_VAA_SLACK_BOT_TOKEN must be specified"
    exit 1
fi

# Context: Of all the cloud functions, there are some that only go into MAINNET and some that go into both MAINNET and TESTNET.
#          There are no cloud functions that only go into TESTNET.
# First, deploy the functions that are common to both MAINNET and TESTNET
gcloud functions --project "$GCP_PROJECT" deploy alarm-missing-vaas --entry-point alarmMissingVaas --gen2 --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars MISSING_VAA_SLACK_CHANNEL_ID=$MISSING_VAA_SLACK_CHANNEL_ID,MISSING_VAA_SLACK_POST_URL=$MISSING_VAA_SLACK_POST_URL,MISSING_VAA_SLACK_BOT_TOKEN=$MISSING_VAA_SLACK_BOT_TOKEN,FIRESTORE_ALARM_MISSING_VAAS_COLLECTION=$FIRESTORE_ALARM_MISSING_VAAS_COLLECTION,FIRESTORE_GOVERNOR_STATUS_COLLECTION=$FIRESTORE_GOVERNOR_STATUS_COLLECTION,FIRESTORE_LATEST_COLLECTION=$FIRESTORE_LATEST_COLLECTION,NETWORK=$NETWORK,FUNCTION=alarmMissingVaas
gcloud functions --project "$GCP_PROJECT" deploy compute-message-count-history --entry-point computeMessageCountHistory --gen2 --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,BIGTABLE_SIGNED_VAAS_TABLE_ID=$BIGTABLE_SIGNED_VAAS_TABLE_ID,FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION=$FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION,NETWORK=$NETWORK,FUNCTION=computeMessageCountHistory
gcloud functions --project "$GCP_PROJECT" deploy compute-message-counts --entry-point computeMessageCounts --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 4GB --region europe-west3 --set-env-vars BIGTABLE_TABLE_ID=$BIGTABLE_TABLE_ID,BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,NETWORK=$NETWORK,FUNCTION=computeMessageCounts
gcloud functions --project "$GCP_PROJECT" deploy compute-missing-vaas --entry-point computeMissingVaas --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 4GB --region europe-west3 --set-env-vars BIGTABLE_TABLE_ID=$BIGTABLE_TABLE_ID,BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,NETWORK=$NETWORK,FUNCTION=computeMissingVaas
gcloud functions --project "$GCP_PROJECT" deploy compute-ntt-rate-limits --entry-point computeNTTRateLimits --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=computeNTTRateLimits
gcloud functions --project "$GCP_PROJECT" deploy compute-total-supply-and-locked --entry-point computeTotalSupplyAndLocked --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=computeTotalSupplyAndLocked
gcloud functions --project "$GCP_PROJECT" deploy get-ntt-rate-limits --entry-point getNTTRateLimits --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=getNTTRateLimits
gcloud functions --project "$GCP_PROJECT" deploy get-total-supply-and-locked --entry-point getTotalSupplyAndLocked --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=getTotalSupplyAndLocked
gcloud functions --project "$GCP_PROJECT" deploy latest-blocks --entry-point getLatestBlocks --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,FIRESTORE_LATEST_COLLECTION=$FIRESTORE_LATEST_COLLECTION,NETWORK=$NETWORK,FUNCTION=getLatestBlocks
gcloud functions --project "$GCP_PROJECT" deploy latest-tvltvm --entry-point getLatestTvlTvm --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,FIRESTORE_LATEST_TVLTVM_COLLECTION=$FIRESTORE_LATEST_TVLTVM_COLLECTION,NETWORK=$NETWORK,FUNCTION=getLatestTvlTvm
gcloud functions --project "$GCP_PROJECT" deploy message-count-history --entry-point getMessageCountHistory --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION=$FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION,NETWORK=$NETWORK,FUNCTION=getMessageCountHistory
gcloud functions --project "$GCP_PROJECT" deploy message-counts --entry-point getMessageCounts --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=getMessageCounts
gcloud functions --project "$GCP_PROJECT" deploy messages --entry-point getMessages --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars BIGTABLE_TABLE_ID=$BIGTABLE_TABLE_ID,BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,CLOUD_FUNCTIONS_NUM_ROWS=$CLOUD_FUNCTIONS_NUM_ROWS,CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,CLOUD_FUNCTIONS_BLOCK_INCREMENT=$CLOUD_FUNCTIONS_BLOCK_INCREMENT,NETWORK=$NETWORK,FUNCTION=getMessages
gcloud functions --project "$GCP_PROJECT" deploy missing-vaas --entry-point getMissingVaas --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=getMissingVaas
gcloud functions --project "$GCP_PROJECT" deploy reobserve-vaas --entry-point getReobserveVaas --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars FIRESTORE_ALARM_MISSING_VAAS_COLLECTION=$FIRESTORE_ALARM_MISSING_VAAS_COLLECTION,NETWORK=$NETWORK,FUNCTION=getReobserveVaas --set-secrets 'REOBSERVE_VAA_API_KEY=Reobs_VAA_API_key_xLabs:1'
gcloud functions --project "$GCP_PROJECT" deploy tvl --entry-point getTVL --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars FIRESTORE_TVL_COLLECTION=$FIRESTORE_TVL_COLLECTION,NETWORK=$NETWORK,FUNCTION=getTVL
gcloud functions --project "$GCP_PROJECT" deploy tvl-history --entry-point getTVLHistory --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars FIRESTORE_TVL_HISTORY_COLLECTION=$FIRESTORE_TVL_HISTORY_COLLECTION,NETWORK=$NETWORK,FUNCTION=getTVLHistory
gcloud functions --project "$GCP_PROJECT" deploy vaas-by-tx-hash --entry-point getVaasByTxHash --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,BIGTABLE_SIGNED_VAAS_TABLE_ID=$BIGTABLE_SIGNED_VAAS_TABLE_ID,BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID=$BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID,NETWORK=$NETWORK,FUNCTION=getVaasByTxHash

#
# Bail out if we are only deploying TESTNET functions
#
if [ "$NETWORK" == "TESTNET" ]; then
    echo "Finished deploying TESTNET functions"
    exit 0
fi

#
# The following are MAINNET only
#
if [ -z "$PG_USER" ]; then
    echo "PG_USER must be specified"
    exit 1
fi

if [ -z "$PG_PASSWORD" ]; then
    echo "PG_PASSWORD must be specified"
    exit 1
fi

if [ -z "$PG_DATABASE" ]; then
    echo "PG_DATABASE must be specified"
    exit 1
fi

if [ -z "$PG_HOST" ] || [ "$PG_HOST" == "localhost" ] || [ "$PG_HOST" == "127.0.0.1" ]; then
    echo "PG_HOST must be specified correctly"
    exit 1
fi

if [ -z "$PG_TOKEN_TRANSFER_TABLE" ]; then
    echo "PG_TOKEN_TRANSFER_TABLE must be specified"
    exit 1
fi

if [ -z "$PG_ATTEST_MESSAGE_TABLE" ]; then
    echo "PG_ATTEST_MESSAGE_TABLE must be specified"
    exit 1
fi

if [ -z "$PG_TOKEN_METADATA_TABLE" ]; then
    echo "PG_TOKEN_METADATA_TABLE must be specified"
    exit 1
fi

if [ -z "$PG_TOKEN_PRICE_HISTORY_TABLE" ]; then
    echo "PG_TOKEN_PRICE_HISTORY_TABLE must be specified"
    exit 1
fi

if [ -z "$PUBSUB_SIGNED_VAA_TOPIC" ]; then
    echo "PUBSUB_SIGNED_VAA_TOPIC must be specified"
    exit 1
fi

if [ -z "$WORMCHAIN_SLACK_CHANNEL_ID" ]; then
    echo "WORMCHAIN_SLACK_CHANNEL_ID must be specified"
    exit 1
fi

if [ -z "$WORMCHAIN_SLACK_POST_URL" ]; then
    echo "WORMCHAIN_SLACK_POST_URL must be specified"
    exit 1
fi

if [ -z "$WORMCHAIN_SLACK_BOT_TOKEN" ]; then
    echo "WORMCHAIN_SLACK_BOT_TOKEN must be specified"
    exit 1
fi

if [ -z "$WORMCHAIN_PAGERDUTY_ROUTING_KEY" ]; then
    echo "WORMCHAIN_PAGERDUTY_ROUTING_KEY must be specified"
    exit 1
fi

if [ -z "$WORMCHAIN_PAGERDUTY_URL" ]; then
    echo "WORMCHAIN_PAGERDUTY_URL must be specified"
    exit 1
fi

if [ -z "$SOLANA_RPC" ]; then
    echo "SOLANA_RPC must be specified"
    exit 1
fi

gcloud functions --project "$GCP_PROJECT" deploy compute-guardian-set-info --entry-point computeGuardianSetInfo --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FIRESTORE_GUARDIAN_SET_INFO_COLLECTION=$FIRESTORE_GUARDIAN_SET_INFO_COLLECTION,FUNCTION=computeGuardianSetInfo
gcloud functions --project "$GCP_PROJECT" deploy compute-tvl --entry-point computeTVL --gen2 --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_ATTEST_MESSAGE_TABLE=$PG_ATTEST_MESSAGE_TABLE,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,PG_TOKEN_TRANSFER_TABLE=$PG_TOKEN_TRANSFER_TABLE,FIRESTORE_TVL_COLLECTION=$FIRESTORE_TVL_COLLECTION,NETWORK=$NETWORK,FUNCTION=computeTVL
gcloud functions --project "$GCP_PROJECT" deploy compute-tvl-history --entry-point computeTVLHistory --gen2 --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 540 --memory 1GB --region europe-west3 --set-env-vars PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_ATTEST_MESSAGE_TABLE=$PG_ATTEST_MESSAGE_TABLE,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,PG_TOKEN_TRANSFER_TABLE=$PG_TOKEN_TRANSFER_TABLE,FIRESTORE_TVL_HISTORY_COLLECTION=$FIRESTORE_TVL_HISTORY_COLLECTION,PG_TOKEN_PRICE_HISTORY_TABLE=$PG_TOKEN_PRICE_HISTORY_TABLE,NETWORK=$NETWORK,FUNCTION=computeTVLHistory
gcloud functions --project "$GCP_PROJECT" deploy compute-tvl-tvm --entry-point computeTvlTvm --gen2 --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 540 --memory 1GB --region europe-west3 --set-env-vars PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,PG_TOKEN_PRICE_HISTORY_TABLE=$PG_TOKEN_PRICE_HISTORY_TABLE,FIRESTORE_LATEST_TVLTVM_COLLECTION=$FIRESTORE_LATEST_TVLTVM_COLLECTION,NETWORK=$NETWORK,FUNCTION=computeTvlTvm
gcloud functions --project "$GCP_PROJECT" deploy get-guardian-set-info --entry-point getGuardianSetInfo --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FIRESTORE_GUARDIAN_SET_INFO_COLLECTION=$FIRESTORE_GUARDIAN_SET_INFO_COLLECTION,FUNCTION=getGuardianSetInfo
gcloud functions --project "$GCP_PROJECT" deploy get-solana-events --entry-point getSolanaEvents --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars SOLANA_RPC=$SOLANA_RPC,NETWORK=$NETWORK,FUNCTION=getSolanaEvents
gcloud functions --project "$GCP_PROJECT" deploy latest-tokendata --entry-point getLatestTokenData --gen2 --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,PG_TOKEN_PRICE_HISTORY_TABLE=$PG_TOKEN_PRICE_HISTORY_TABLE,NETWORK=$NETWORK,FUNCTION=getLatestTokenData
gcloud functions --project "$GCP_PROJECT" deploy process-vaa --entry-point processVaa --gen2 --runtime nodejs18 --timeout 300 --memory 512MB --region europe-west3 --trigger-topic $PUBSUB_SIGNED_VAA_TOPIC --set-env-vars BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,BIGTABLE_SIGNED_VAAS_TABLE_ID=$BIGTABLE_SIGNED_VAAS_TABLE_ID,BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID=$BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID,PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_TOKEN_TRANSFER_TABLE=$PG_TOKEN_TRANSFER_TABLE,PG_ATTEST_MESSAGE_TABLE=$PG_ATTEST_MESSAGE_TABLE,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,NETWORK=$NETWORK,FUNCTION=processVaa
gcloud functions --project "$GCP_PROJECT" deploy refresh-todays-token-prices --entry-point refreshTodaysTokenPrices --gen2 --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,PG_TOKEN_PRICE_HISTORY_TABLE=$PG_TOKEN_PRICE_HISTORY_TABLE,NETWORK=$NETWORK,FUNCTION=refreshTodaysTokenPrices
gcloud functions --project "$GCP_PROJECT" deploy update-token-metadata --entry-point updateTokenMetadata --gen2 --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,NETWORK=$NETWORK,FUNCTION=updateTokenMetadata
gcloud functions --project "$GCP_PROJECT" deploy wormchain-monitor --entry-point wormchainMonitor --gen2 --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars WORMCHAIN_SLACK_CHANNEL_ID=$WORMCHAIN_SLACK_CHANNEL_ID,WORMCHAIN_SLACK_POST_URL=$WORMCHAIN_SLACK_POST_URL,WORMCHAIN_SLACK_BOT_TOKEN=$WORMCHAIN_SLACK_BOT_TOKEN,WORMCHAIN_PAGERDUTY_ROUTING_KEY=$WORMCHAIN_PAGERDUTY_ROUTING_KEY,WORMCHAIN_PAGERDUTY_URL=$WORMCHAIN_PAGERDUTY_URL,NETWORK=$NETWORK,FUNCTION=wormchainMonitor

if [ "$NETWORK" == "MAINNET" ]; then
    echo "Finished deploying MAINNET functions"
    exit 0
fi
