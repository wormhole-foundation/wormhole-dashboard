#!/bin/bash
set -e

if [ -z "$GCP_PROJECT" ]; then
    echo "GCP_PROJECT must be specified"
    exit 1
fi

gcloud functions --project "$GCP_PROJECT" deploy guardian-heartbeats --region=europe-west3 --entry-point Heartbeats --memory=256MB --runtime go121 --trigger-http --allow-unauthenticated --update-env-vars GCP_PROJECT="$GCP_PROJECT"
gcloud functions --project "$GCP_PROJECT" deploy governor-status --region=europe-west3 --entry-point GovernorStatus --memory=256MB --runtime go121 --trigger-http --allow-unauthenticated --update-env-vars GCP_PROJECT="$GCP_PROJECT"
gcloud functions --project "$GCP_PROJECT" deploy governor-configs --region=europe-west3 --entry-point GovernorConfigs --memory=256MB --runtime go121 --trigger-http --allow-unauthenticated --update-env-vars GCP_PROJECT="$GCP_PROJECT"
