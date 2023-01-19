#!/bin/bash
source .env
set -e

# SET ENV VARIABLES
# note: load the service account key for either bigtable or firestore before running their respective CFs
# e.g., EXPORT GOOGLE_APPLICATION_CREDENTIALS=<path-to-credentials>
# export env variables: BIGTABLE_INSTANCE_ID, BIGTABLE_TABLE_ID, CLOUD_FUNCTIONS_NUM_ROWS
# or source .env
# make sure you npm run build in the root folder before trying to deploy :D

if [ -z "$BIGTABLE_INSTANCE_ID" ]; then
    echo "BIGTABLE_INSTANCE_ID must be specified"
    exit 1
fi

if [ -z "$BIGTABLE_TABLE_ID" ]; then
    echo "BIGTABLE_TABLE_ID must be specified"
    exit 1
fi

# note CLOUD_FUNCTIONS_NUM_ROWS isn't required and defaults to 100 if not provided

# for initial deployment
# echo "gcloud functions deploy messages  --entry-point getMessages  --runtime nodejs16 --trigger-http --allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars BIGTABLE_TABLE_ID=$BIGTABLE_TABLE_ID,BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,CLOUD_FUNCTIONS_NUM_ROWS=$CLOUD_FUNCTIONS_NUM_ROWS,CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,CLOUD_FUNCTIONS_BLOCK_INCREMENT=$CLOUD_FUNCTIONS_BLOCK_INCREMENT"

gcloud functions deploy messages  --entry-point getMessages  --runtime nodejs16 --trigger-http --allow-unauthenticated --timeout 300 --memory 1GB --region europe-west3 --set-env-vars BIGTABLE_TABLE_ID=$BIGTABLE_TABLE_ID,BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,CLOUD_FUNCTIONS_NUM_ROWS=$CLOUD_FUNCTIONS_NUM_ROWS,CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,CLOUD_FUNCTIONS_BLOCK_INCREMENT=$CLOUD_FUNCTIONS_BLOCK_INCREMENT
gcloud functions deploy message-counts  --entry-point getMessageCounts  --runtime nodejs16 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3
gcloud functions deploy compute-message-counts  --entry-point computeMessageCounts  --runtime nodejs16 --trigger-http --allow-unauthenticated --timeout 300 --memory 4GB --region europe-west3 --set-env-vars BIGTABLE_TABLE_ID=$BIGTABLE_TABLE_ID,BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL
gcloud functions deploy latest-blocks  --entry-point getLatestBlocks  --runtime nodejs16 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3 --set-env-vars CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL,FIRESTORE_LATEST_COLLECTION=$FIRESTORE_LATEST_COLLECTION
gcloud functions deploy compute-missing-vaas  --entry-point computeMissingVaas  --runtime nodejs16 --trigger-http --allow-unauthenticated --timeout 300 --memory 2GB --region europe-west3 --set-env-vars BIGTABLE_TABLE_ID=$BIGTABLE_TABLE_ID,BIGTABLE_INSTANCE_ID=$BIGTABLE_INSTANCE_ID,CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL=$CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL
gcloud functions deploy missing-vaas  --entry-point getMissingVaas  --runtime nodejs16 --trigger-http --allow-unauthenticated --timeout 300 --memory 256MB --region europe-west3

