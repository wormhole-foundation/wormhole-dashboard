FROM --platform=linux/amd64 ghcr.io/foundry-rs/foundry:nightly-55bf41564f605cae3ca4c95ac5d468b1f14447f9@sha256:8c15d322da81a6deaf827222e173f3f81c653136a3518d5eeb41250a0f2e17ea AS foundry
FROM --platform=linux/amd64 node:20-slim@sha256:0251f1fd7d2c60614c73df5f7dd9006e2592fd38b1cf6c5c9f21b4f0d9aa8a2f AS build

RUN apt update && apt install -y git make

COPY --from=foundry /usr/local/bin/anvil /bin/anvil
COPY --from=foundry /usr/local/bin/forge /bin/forge

WORKDIR /app

RUN git init
RUN git remote add origin https://github.com/wormhole-foundation/example-liquidity-layer.git
RUN git fetch origin 86d6806f3ec38bd784d10f1da9e725f8e02628a5
RUN git checkout FETCH_HEAD

RUN cd evm && make
RUN npm run build && npm run pack && cp *.tgz .. 

FROM scratch AS export
COPY --from=build wormhole-foundation-example-liquidity-layer-definitions-0.0.1.tgz .
COPY --from=build wormhole-foundation-example-liquidity-layer-evm-0.0.1.tgz .
COPY --from=build wormhole-foundation-example-liquidity-layer-solana-0.0.1.tgz .
