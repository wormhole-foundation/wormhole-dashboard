FROM --platform=linux/amd64 docker.io/golang:1.26.10-bookworm@sha256:23ce71337b726608afb1bc00986e630a05034a87a87ea1fc2cd1ae5cf33387eb

WORKDIR /app

COPY . .

WORKDIR /app/cmd/prom_gossip

RUN go build main.go

CMD [ "./main" ]
