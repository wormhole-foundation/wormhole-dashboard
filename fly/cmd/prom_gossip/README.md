# Prometheus Gossip Metrics

This utility provides additional Prometheus metrics for the gossip network

To easily run all of the services with a preconfigured dashboard, from this folder, simply:

```bash
docker compose up
```

To view the dashboard, navigate to [http://localhost:3000](http://localhost:3000)

Login with the default username and password: `admin`:`admin`

Check out the automatically provisioned Gossip Metrics dashboard

The rest of this document provides additional, advanced details

## Run the service

From this folder,

```bash
go run main.go
```

## Run a Prometheus server

From this folder,

```bash
docker run -p 9090:9090 -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus
```

### View the metrics

Navigate to [http://localhost:9090/graph](http://localhost:9090/graph)

Try some useful queries:

#### Gossip messages per second

Total

```
sum(rate(gossip_by_type_total[1m]))
```

Per type

```
rate(gossip_by_type_total[1m])
```

#### Unique Observations / VAAs per second

Observations

```
rate(gossip_observations_unique_total[1m])
```

VAAs

```
rate(gossip_vaas_unique_total[1m])
```

#### Observations by Guardian / Chain

Per second by guardian and chain

```
rate(gossip_observations_by_guardian_per_chain_total[1m])
```

Sum by guardian

```
sum by (guardian_name) (gossip_observations_by_guardian_per_chain_total)
```

Sum by chain

```
sum by (chain_name) (gossip_observations_by_guardian_per_chain_total)
```

Per second by chain

```
sum by (chain_name) (rate(gossip_observations_by_guardian_per_chain_total[1m]))
```

#### Token Bridge observations by Guardian / Chain

Per second by guardian and chain

```
rate(gossip_token_bridge_observations_by_guardian_per_chain_total[1m])
```

Sum by guardian

```
sum by (guardian_name) (gossip_token_bridge_observations_by_guardian_per_chain_total)
```

Sum by chain

```
sum by (chain_name) (gossip_token_bridge_observations_by_guardian_per_chain_total)
```

Per second by chain

```
sum by (chain_name) (rate(gossip_token_bridge_observations_by_guardian_per_chain_total[1m]))
```

## Run a Grafana server

```bash
docker run -p 3000:3000 grafana/grafana-oss
```

### Add a data source

To add the Prometheus server as a data source

- Connections
- Data sources
- Add data source
- Prometheus
- Connection - `http://prometheus:9090`
- Save & test

### Import a dashboard

To import the provided `gossip_metrics.json` dashboard

- Dashboards
- New
- Import
- Drag and drop or copy and paste the contents of `dashboards/gossip_metrics.json`
- Load
- Import

### Exporting a data source and provisioning it at startup

After logging in, navigate to [http://localhost:3000/api/datasources](http://localhost:3000/api/datasources)

See [https://grafana.com/docs/grafana/latest/administration/provisioning/](https://grafana.com/docs/grafana/latest/administration/provisioning/) for details on provisioning.
