to run cloud functions locally: https://cloud.google.com/functions/docs/running/function-frameworks

To deploy: see scripts/deploy.sh
Be sure to first export env variables: BIGTABLE_INSTANCE_ID, BIGTABLE_TABLE_ID, CLOUD_FUNCTIONS_NUM_ROWS, CLOUD_FUNCTIONS_REFRESH_TIME_INTERVAL, CLOUD_FUNCTIONS_BLOCK_INCREMENT (see .env.sample)

> format of a deploy command:

1. name of cloud function - https://<location>-<project>.cloudfunctions.net/<name of cloud function>
2. name of function - name of function that creates the data sent to the endpoint. must be exported in index.js
3. timeout in seconds
4. set-env-vars/update-env-vars - list of env variables (format is ENV_VAR_NAME="something-cool") used in function accessed by "process.env.ENV_VAR_NAME". list format, separated by commas, no spaces
   If you want to just update the env variables without destroying them, use "update-env-vars"

gcloud functions deploy <name of cloud function> --entry-point <name of function> --runtime nodejs16 --trigger-http --allow-unauthenticated --timeout 300 --memory 1GB --region <location> --set-env-vars LIST_OF_ENV_VARS

Note: these cloud functions are managed in conjunction with cloud storage (caches) and cloud scheduler (cron job to perdiodically compute cloud functions)
