FROM --platform=linux/amd64 docker.io/golang:1.23.6-bullseye@sha256:13ae4c4b1ee4c1d1983c8dcbbbb7db7aea3972b0853bb1d01b37176567448762

WORKDIR /app

COPY . .

WORKDIR /app/cmd/prom_gossip

RUN go build main.go

CMD [ "./main" ]
