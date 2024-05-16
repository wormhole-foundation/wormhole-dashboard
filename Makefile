.PHONY: clean
clean:
	$(MAKE) fast-transfer-clean
	rm -rf node_modules

.PHONY: fast-transfer-sync
fast-transfer-sync:
	git submodule update --checkout
	git submodule sync --recursive

.PHONY: fast-transfer-clean
fast-transfer-clean: fast-transfer-sync
	cd watcher/sdk/example-liquidity-layer/solana && $(MAKE) clean

.PHONY: fast-transfer-setup
fast-transfer-setup: fast-transfer-sync
	cd watcher/sdk/example-liquidity-layer/solana && $(MAKE) anchor-test-setup

.PHONY: fast-transfer-sdk
fast-transfer-sdk: fast-transfer-setup
	cd watcher/sdk/example-liquidity-layer \
	&& $(MAKE) build \
	&& npm run build -w solana \
	&& npm pack -w universal/ts -w solana

node_modules: fast-transfer-sdk
	npm install -w solana watcher/sdk/example-liquidity-layer/wormhole-foundation-example-liquidity-layer-*
	npm ci
