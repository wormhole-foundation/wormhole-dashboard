The cloud-functions can be run locally by:

```bash
# Spin up a local development server for quick testing
export GCP_PROJECT=""
export GOOGLE_APPLICATION_CREDENTIALS=""
go run cmd/main.go

# Invoke a function in response to a request
curl localhost:8080/guardian-heartbeats
```
