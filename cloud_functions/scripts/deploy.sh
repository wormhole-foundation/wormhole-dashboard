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
if [ -z "$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL" ]; then
    echo "CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL be specified"
    exit 1
fi

if [ -z "$FIRESTORE_GUARDIAN_HEARTBEAT_COLLECTION" ]; then
    echo "FIRESTORE_GUARDIAN_HEARTBEAT_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_LATEST_COLLECTION" ]; then
    echo "FIRESTORE_LATEST_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_MISSING_VAAS_COLLECTION" ]; then
    echo "FIRESTORE_MISSING_VAAS_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_ALARM_MISSING_VAAS_COLLECTION" ]; then
    echo "FIRESTORE_ALARM_MISSING_VAAS_COLLECTION must be specified"
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
gcloud functions --project "$GCP_PROJECT" deploy alarm-missing-vaas --entry-point alarmMissingVaas --gen2 --runtime nodejs22 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars MISSING_VAA_SLACK_CHANNEL_ID=$MISSING_VAA_SLACK_CHANNEL_ID,MISSING_VAA_SLACK_POST_URL=$MISSING_VAA_SLACK_POST_URL,MISSING_VAA_SLACK_BOT_TOKEN=$MISSING_VAA_SLACK_BOT_TOKEN,FIRESTORE_ALARM_MISSING_VAAS_COLLECTION=$FIRESTORE_ALARM_MISSING_VAAS_COLLECTION,FIRESTORE_MISSING_VAAS_COLLECTION=$FIRESTORE_MISSING_VAAS_COLLECTION,FIRESTORE_GOVERNOR_STATUS_COLLECTION=$FIRESTORE_GOVERNOR_STATUS_COLLECTION,FIRESTORE_LATEST_COLLECTION=$FIRESTORE_LATEST_COLLECTION,FIRESTORE_GUARDIAN_HEARTBEAT_COLLECTION=$FIRESTORE_GUARDIAN_HEARTBEAT_COLLECTION,NETWORK=$NETWORK,FUNCTION=alarmMissingVaas
gcloud functions --project "$GCP_PROJECT" deploy compute-ntt-rate-limits --entry-point computeNTTRateLimits --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=computeNTTRateLimits
gcloud functions --project "$GCP_PROJECT" deploy compute-total-supply-and-locked --entry-point computeTotalSupplyAndLocked --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=computeTotalSupplyAndLocked
gcloud functions --project "$GCP_PROJECT" deploy get-ntt-rate-limits --entry-point getNTTRateLimits --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=getNTTRateLimits
gcloud functions --project "$GCP_PROJECT" deploy governor-configs --entry-point getGovernorConfigs --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=getGovernorConfigs
gcloud functions --project "$GCP_PROJECT" deploy governor-status --entry-point getGovernorStatus --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=getGovernorStatus
gcloud functions --project "$GCP_PROJECT" deploy guardian-heartbeats --entry-point getGuardianHeartbeats --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=getGuardianHeartbeats
gcloud functions --project "$GCP_PROJECT" deploy get-quorum-height --entry-point getQuorumHeight --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,NETWORK=$NETWORK,FUNCTION=getQuorumHeight
gcloud functions --project "$GCP_PROJECT" deploy get-total-supply-and-locked --entry-point getTotalSupplyAndLocked --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FUNCTION=getTotalSupplyAndLocked
gcloud functions --project "$GCP_PROJECT" deploy latest-blocks --entry-point getLatestBlocks --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,FIRESTORE_LATEST_COLLECTION=$FIRESTORE_LATEST_COLLECTION,NETWORK=$NETWORK,FUNCTION=getLatestBlocks
gcloud functions --project "$GCP_PROJECT" deploy missing-vaas --entry-point getMissingVaas --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars FIRESTORE_MISSING_VAAS_COLLECTION=$FIRESTORE_MISSING_VAAS_COLLECTION,NETWORK=$NETWORK,FUNCTION=getMissingVaas
gcloud functions --project "$GCP_PROJECT" deploy reobserve-vaas --entry-point getReobserveVaas --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars FIRESTORE_ALARM_MISSING_VAAS_COLLECTION=$FIRESTORE_ALARM_MISSING_VAAS_COLLECTION,NETWORK=$NETWORK,FUNCTION=getReobserveVaas --set-secrets 'REOBSERVE_VAA_API_KEY=Reobs_VAA_API_Key_Syncnode:1'

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

if [ -z "$FIRESTORE_TVL_COLLECTION" ]; then
    echo "FIRESTORE_TVL_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_TVL_METADATA_COLLECTION" ]; then
    echo "FIRESTORE_TVL_METADATA_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_LATEST_TOKEN_DATA_COLLECTION" ]; then
    echo "FIRESTORE_LATEST_TOKEN_DATA_COLLECTION must be specified"
    exit 1
fi

if [ -z "$FIRESTORE_GUARDIAN_SET_INFO_COLLECTION" ]; then
    echo "FIRESTORE_GUARDIAN_SET_INFO_COLLECTION must be specified"
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

gcloud functions --project "$GCP_PROJECT" deploy compute-guardian-set-info --entry-point computeGuardianSetInfo --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FIRESTORE_GUARDIAN_SET_INFO_COLLECTION=$FIRESTORE_GUARDIAN_SET_INFO_COLLECTION,FUNCTION=computeGuardianSetInfo
gcloud functions --project "$GCP_PROJECT" deploy compute-tvl --entry-point computeTVL --gen2 --runtime nodejs22 --trigger-http --no-allow-unauthenticated --timeout 540 --memory 1GB --region europe-west3 --set-env-vars FIRESTORE_TVL_COLLECTION=$FIRESTORE_TVL_COLLECTION,FIRESTORE_TVL_METADATA_COLLECTION=$FIRESTORE_TVL_METADATA_COLLECTION,FIRESTORE_LATEST_TOKEN_DATA_COLLECTION=$FIRESTORE_LATEST_TOKEN_DATA_COLLECTION,NETWORK=$NETWORK,FUNCTION=computeTVL --set-secrets 'COINGECKO_API_KEY=CoinGecko_API_Key:1'
gcloud functions --project "$GCP_PROJECT" deploy get-guardian-set-info --entry-point getGuardianSetInfo --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars NETWORK=$NETWORK,FIRESTORE_GUARDIAN_SET_INFO_COLLECTION=$FIRESTORE_GUARDIAN_SET_INFO_COLLECTION,FUNCTION=getGuardianSetInfo
gcloud functions --project "$GCP_PROJECT" deploy get-solana-events --entry-point getSolanaEvents --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars SOLANA_RPC=$SOLANA_RPC,NETWORK=$NETWORK,FUNCTION=getSolanaEvents
gcloud functions --project "$GCP_PROJECT" deploy latest-tokendata --entry-point getLatestTokenData --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,FIRESTORE_LATEST_TOKEN_DATA_COLLECTION=$FIRESTORE_LATEST_TOKEN_DATA_COLLECTION,NETWORK=$NETWORK,FUNCTION=getLatestTokenData
gcloud functions --project "$GCP_PROJECT" deploy wormchain-monitor --entry-point wormchainMonitor --gen2 --runtime nodejs22 --trigger-http --no-allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars WORMCHAIN_SLACK_CHANNEL_ID=$WORMCHAIN_SLACK_CHANNEL_ID,WORMCHAIN_SLACK_POST_URL=$WORMCHAIN_SLACK_POST_URL,WORMCHAIN_SLACK_BOT_TOKEN=$WORMCHAIN_SLACK_BOT_TOKEN,WORMCHAIN_PAGERDUTY_ROUTING_KEY=$WORMCHAIN_PAGERDUTY_ROUTING_KEY,WORMCHAIN_PAGERDUTY_URL=$WORMCHAIN_PAGERDUTY_URL,NETWORK=$NETWORK,FUNCTION=wormchainMonitor
gcloud functions --project "$GCP_PROJECT" deploy tvl --entry-point getTVL --gen2 --runtime nodejs22 --trigger-http --allow-unauthenticated --timeout 300 --memory 512MB --region europe-west3 --set-env-vars FIRESTORE_TVL_COLLECTION=$FIRESTORE_TVL_COLLECTION,NETWORK=$NETWORK,FUNCTION=getTVL

if [ "$NETWORK" == "MAINNET" ]; then
    echo "Finished deploying MAINNET functions"
    exit 0
fi
