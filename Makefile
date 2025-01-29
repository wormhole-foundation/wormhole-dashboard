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

.PHONY: init-submodule
init-submodule:
	git submodule update --init --recursive

.PHONY: build=ft=forge
build-ft-forge: check-submodule
	cd watcher/sdk/example-liquidity-layer/evm \
	&& make && cd -

.PHONY: build-ft-sdk
build-ft-sdk: build-ft-forge
	cd watcher/sdk/example-liquidity-layer \
	&& npm ci \
	&& npm run build \
	&& npm run pack \
	&& cp *.tgz .. \
	&& cd -

SUBMODULE_PATH = watcher/sdk/example-liquidity-layer
EXPECTED_COMMIT = $(shell git config --file .gitmodules --get submodule.$(SUBMODULE_PATH).rev)
ACTUAL_COMMIT = $(shell git -C $(SUBMODULE_PATH) rev-parse HEAD)

.PHONY: check-submodule
check-submodule:
	@echo "Expected commit: $(EXPECTED_COMMIT)"
	@echo "Actual commit: $(ACTUAL_COMMIT)"
	@if [ "$(EXPECTED_COMMIT)" != "$(ACTUAL_COMMIT)" ]; then \
		echo "❌ Submodule $(SUBMODULE_PATH) is not at the expected commit!"; \
		exit 1; \
	fi
	@echo "✅ Submodule is at the correct commit."
