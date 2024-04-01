# Historical Uptime Service

This service tracks the historical uptime of Wormhole guardians by listening to heartbeats and observations from the Wormhole network.

## Prerequisites

Before running the service, ensure you have the following:

1. Go installed (version 1.20)
2. Prometheus remote write URL for metrics
3. Google Cloud Platform (GCP) project with BigTable instance

For development environment, make sure you have the following:

1. Local Prometheus instance
2. Local BigTable emulator

To set up BigTable emulator locally, you can follow the tutorial [here](https://cloud.google.com/bigtable/docs/emulator) or execute this command below with Docker running:

```
docker run -p 127.0.0.1:8086:8086 --rm -ti google/cloud-sdk gcloud beta emulators bigtable start --host-port=0.0.0.0:8086
```

## BigTable

1. Set up a BigTable instance. You can follow the tutorials found [online](https://cloud.google.com/bigtable/docs/creating-instance).

2. Then set up the tables in the instance you created. Tutorials can be found [here](https://cloud.google.com/bigtable/docs/managing-tables#gcloud).

   There are 3 tables and the column families that you need for this project.

   | Table Name                        | Column Families   |
   | --------------------------------- | ----------------- |
   | `historical_uptime_messages`      | `messageData`     |
   | `historical_uptime_observations`  | `observationData` |
   | `historical_uptime_message_index` | `indexData`       |

   For example, if you are using `gcloud` to create the `historical_uptime_messages` table:

   ```bash
   gcloud bigtable instances tables create historical_uptime_messages \
   	--instance=bigtable-instance-id \
   	--project=gcp-project-id \
   	--column-families=messageData
   ```

3. Lastly, remember to configure a service account in IAM to allow access control to this BigTable instance. Details can be found [here](https://cloud.google.com/bigtable/docs/access-control).

   Keys exported should be stored in `/path/to/credentials.json` and the path is required in `.env` later.

## Configuration

The service can be configured using environment variables. Create a `.env` file in the `cmd/historical_uptime` directory with the following variables:

```
P2P_NETWORK_ID=/wormhole/mainnet/2
P2P_PORT=8999
NODE_KEY_PATH=/tmp/node.key
LOG_LEVEL=info
ETH_RPC_URL=https://rpc.ankr.com/eth
CORE_BRIDGE_ADDR=0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B
PROM_REMOTE_URL=https://prometheus_remote_url/api/v1/write
GCP_PROJECT_ID=gcp-project-id
GCP_CREDENTIALS_FILE=/path/to/credentials.json
BIGTABLE_INSTANCE_ID=bigtable-instance-id
USE_BIGTABLE_EMULATOR=false
BIGTABLE_EMULATOR_HOST=
```

For development environment, update add the 2 environment variables below:

```
# USE_BIGTABLE_EMULATOR configures the BigTable library to use local emulator instead
USE_BIGTABLE_EMULATOR=true

# BIGTABLE_EMULATOR_HOST defines where the emulator is hosted
BIGTABLE_EMULATOR_HOST=localhost:8086
```

## Running the Service

To run the service, execute the following commands:

```bash
cd fly/cmd/historical_uptime
go run main.go
```

## Metrics

The Historical Uptime Service exports the following metrics to Prometheus:

| Metric Name                          | Description                                                                                                                                                                                                                   | Labels                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `guardian_observations_total`        | The number of observations done by each guardian on each chain. This tracks if guardians are doing any observations at any time.                                                                                              | `guardian`, `chain_name` |
| `guardian_missed_observations_total` | The number of observations missed by each guardian. This tracks if the guardians are doing observations late or not doing them at all.                                                                                        | `guardian`, `chain_name` |
| `guardian_chain_height`              | The current blockheight for each chain on each guardian.                                                                                                                                                                      | `guardian`, `chain_name` |
| `guardian_chain_height_differences`  | The current difference between the blockheight of each guardian for each chain and the maximum blockheight of the chain across all guardians. This tracks if a guardian is behind on syncing their nodes for each blockchain. | `guardian`, `chain_name` |
| `guardian_heartbeats`                | The number of heartbeats sent by a guardian. A decrease in this means that a guardian has been reset.                                                                                                                         | `guardian`               |

These metrics can be accessed via the Prometheus remote write URL configured in the `.env` file.

> **Note:** The `guardian_missed_observations_total` metric has a 30-hour delay to account for potential governor delays and network delays. To learn more, please refer to the [monorepo](https://github.com/wormhole-foundation/wormhole/blob/main/node/pkg/processor/cleanup.go#L60-L63).

## Testing

The Historical Uptime Monitor includes a suite of tests to ensure its functionality and reliability. To run the test, follow these steps:

1. Make sure you have all the prerequisites installed and the development environment set up as described in the [Prerequisites](##Prerequisites) section.

2. Navigate to the `fly` directory:

```bash
cd fly
```

3. Run the tests using the following commands:

```bash
# for BigTable specific functionalities
go test -v pkg/bigtable/message_test.go pkg/bigtable/message.go pkg/bigtable/message_index.go pkg/bigtable/test_setup.go pkg/bigtable/observation.go

# for higher level historical_uptime functionalities
go test -v pkg/historical_uptime/process_observation_test.go pkg/historical_uptime/process_observation.go
```

> **Note:** Please make sure that the Bigtable emulator is running as these tests depend on it.
