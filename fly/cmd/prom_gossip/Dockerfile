FROM --platform=linux/amd64 docker.io/golang:1.21.9-bullseye@sha256:311468bffa9fa4747a334b94e6ce3681b564126d653675a6adc46698b2b88d35

WORKDIR /app

COPY . .

WORKDIR /app/cmd/prom_gossip

RUN go build main.go

CMD [ "./main" ]
