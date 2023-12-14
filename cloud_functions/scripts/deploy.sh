#!/bin/bash
source .env
set -e

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

# Hack to make these packages available in the GCP build until they're published.
# This hack applies to both testnet and mainnet functions.
npm pack --silent --workspace @wormhole-foundation/wormhole-monitor-common --pack-destination ./dist/src
npm pack --silent --workspace @wormhole-foundation/wormhole-monitor-database --pack-destination ./dist/src

# Context: Of all the cloud functions, there are some that only go into MAINNET and some that go into both MAINNET and TESTNET.
#          There are no cloud functions that only go into TESTNET.
# First, deploy the functions that are common to both MAINNET and TESTNET
gcloud functions --project "$GCP_PROJECT" deploy alarm-missing-vaas --entry-point alarmMissingVaas --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars MISSING_VAA_SLACK_CHANNEL_ID=$MISSING_VAA_SLACK_CHANNEL_ID,MISSING_VAA_SLACK_POST_URL=$MISSING_VAA_SLACK_POST_URL,MISSING_VAA_SLACK_BOT_TOKEN=$MISSING_VAA_SLACK_BOT_TOKEN,FIRESTORE_ALARM_MISSING_VAAS_COLLECTION=$FIRESTORE_ALARM_MISSING_VAAS_COLLECTION,FIRESTORE_GOVERNOR_STATUS_COLLECTION=$FIRESTORE_GOVERNOR_STATUS_COLLECTION,FIRESTORE_LATEST_COLLECTION=$FIRESTORE_LATEST_COLLECTION
gcloud functions --project "$GCP_PROJECT" deploy compute-message-count-history --entry-point computeMessageCountHistory --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,BIGTABLE_SIGNED_VAAS_TABLE_ID=$BIGTABLE_SIGNED_VAAS_TABLE_ID,FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION=$FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION
gcloud functions --project "$GCP_PROJECT" deploy compute-message-counts --entry-point computeMessageCounts --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 4GB --region europe-west3 --set-env-vars BIGTABLE_TABLE_ID=$BIGTABLE_TABLE_ID,BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL
gcloud functions --project "$GCP_PROJECT" deploy compute-missing-vaas --entry-point computeMissingVaas --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 2GB --region europe-west3 --set-env-vars BIGTABLE_TABLE_ID=$BIGTABLE_TABLE_ID,BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL
gcloud functions --project "$GCP_PROJECT" deploy latest-blocks --entry-point getLatestBlocks --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,FIRESTORE_LATEST_COLLECTION=$FIRESTORE_LATEST_COLLECTION
gcloud functions --project "$GCP_PROJECT" deploy latest-tvltvm --entry-point getLatestTvlTvm --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,FIRESTORE_LATEST_TVLTVM_COLLECTION=$FIRESTORE_LATEST_TVLTVM_COLLECTION
gcloud functions --project "$GCP_PROJECT" deploy message-count-history --entry-point getMessageCountHistory --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION=$FIRESTORE_MESSAGE_COUNT_HISTORY_COLLECTION
gcloud functions --project "$GCP_PROJECT" deploy message-counts --entry-point getMessageCounts --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3
gcloud functions --project "$GCP_PROJECT" deploy messages --entry-point getMessages --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars BIGTABLE_TABLE_ID=$BIGTABLE_TABLE_ID,BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,CLOUD_FUNCTIONS_NUM_ROWS=$CLOUD_FUNCTIONS_NUM_ROWS,CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,CLOUD_FUNCTIONS_BLOCK_INCREMENT=$CLOUD_FUNCTIONS_BLOCK_INCREMENT
gcloud functions --project "$GCP_PROJECT" deploy missing-vaas --entry-point getMissingVaas --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3
gcloud functions --project "$GCP_PROJECT" deploy reobserve-vaas --entry-point getReobserveVaas --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars FIRESTORE_ALARM_MISSING_VAAS_COLLECTION=$FIRESTORE_ALARM_MISSING_VAAS_COLLECTION --set-secrets 'REOBSERVE_VAA_API_KEY=Reobs_VAA_API_key_xLabs:1'
gcloud functions --project "$GCP_PROJECT" deploy tvl --entry-point getTVL --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars FIRESTORE_TVL_COLLECTION=$FIRESTORE_TVL_COLLECTION
gcloud functions --project "$GCP_PROJECT" deploy tvl-history --entry-point getTVLHistory --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars FIRESTORE_TVL_HISTORY_COLLECTION=$FIRESTORE_TVL_HISTORY_COLLECTION
gcloud functions --project "$GCP_PROJECT" deploy vaas-by-tx-hash --entry-point getVaasByTxHash --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,BIGTABLE_SIGNED_VAAS_TABLE_ID=$BIGTABLE_SIGNED_VAAS_TABLE_ID,BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID=$BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID

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
gcloud functions --project "$GCP_PROJECT" deploy compute-tvl --entry-point computeTVL --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_ATTEST_MESSAGE_TABLE=$PG_ATTEST_MESSAGE_TABLE,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,PG_TOKEN_TRANSFER_TABLE=$PG_TOKEN_TRANSFER_TABLE,FIRESTORE_TVL_COLLECTION=$FIRESTORE_TVL_COLLECTION
gcloud functions --project "$GCP_PROJECT" deploy compute-tvl-history --entry-point computeTVLHistory --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 540 --memory 1GB --region europe-west3 --set-env-vars PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_ATTEST_MESSAGE_TABLE=$PG_ATTEST_MESSAGE_TABLE,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,PG_TOKEN_TRANSFER_TABLE=$PG_TOKEN_TRANSFER_TABLE,FIRESTORE_TVL_HISTORY_COLLECTION=$FIRESTORE_TVL_HISTORY_COLLECTION,PG_TOKEN_PRICE_HISTORY_TABLE=$PG_TOKEN_PRICE_HISTORY_TABLE
gcloud functions --project "$GCP_PROJECT" deploy compute-tvl-tvm --entry-point computeTvlTvm --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 540 --memory 1GB --region europe-west3 --set-env-vars PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,PG_TOKEN_PRICE_HISTORY_TABLE=$PG_TOKEN_PRICE_HISTORY_TABLE,FIRESTORE_LATEST_TVLTVM_COLLECTION=$FIRESTORE_LATEST_TVLTVM_COLLECTION
gcloud functions --project "$GCP_PROJECT" deploy latest-tokendata --entry-point getLatestTokenData --runtime nodejs18 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,PG_TOKEN_PRICE_HISTORY_TABLE=$PG_TOKEN_PRICE_HISTORY_TABLE
gcloud functions --project "$GCP_PROJECT" deploy process-vaa --entry-point processVaa --runtime nodejs18 --timeout 300 --memory 256MB --region europe-west3 --trigger-topic $PUBSUB_SIGNED_VAA_TOPIC --set-env-vars BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,BIGTABLE_SIGNED_VAAS_TABLE_ID=$BIGTABLE_SIGNED_VAAS_TABLE_ID,BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID=$BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID,PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_TOKEN_TRANSFER_TABLE=$PG_TOKEN_TRANSFER_TABLE,PG_ATTEST_MESSAGE_TABLE=$PG_ATTEST_MESSAGE_TABLE,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE
gcloud functions --project "$GCP_PROJECT" deploy refresh-todays-token-prices --entry-point refreshTodaysTokenPrices --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE,PG_TOKEN_PRICE_HISTORY_TABLE=$PG_TOKEN_PRICE_HISTORY_TABLE
gcloud functions --project "$GCP_PROJECT" deploy update-token-metadata --entry-point updateTokenMetadata --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars PG_USER=$PG_USER,PG_PASSWORD=$PG_PASSWORD,PG_DATABASE=$PG_DATABASE,PG_HOST=$PG_HOST,PG_TOKEN_METADATA_TABLE=$PG_TOKEN_METADATA_TABLE
gcloud functions --project "$GCP_PROJECT" deploy wormchain-monitor --entry-point wormchainMonitor --runtime nodejs18 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars WORMCHAIN_SLACK_CHANNEL_ID=$WORMCHAIN_SLACK_CHANNEL_ID,WORMCHAIN_SLACK_POST_URL=$WORMCHAIN_SLACK_POST_URL,WORMCHAIN_SLACK_BOT_TOKEN=$WORMCHAIN_SLACK_BOT_TOKEN,WORMCHAIN_PAGERDUTY_ROUTING_KEY=$WORMCHAIN_PAGERDUTY_ROUTING_KEY,WORMCHAIN_PAGERDUTY_URL=$WORMCHAIN_PAGERDUTY_URL

if [ "$NETWORK" == "MAINNET" ]; then
    echo "Finished deploying MAINNET functions"
    exit 0
fi
