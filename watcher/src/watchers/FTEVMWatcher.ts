import knex, { Knex } from 'knex';
import { Watcher } from './Watcher';
import { Network } from '@wormhole-foundation/sdk-base';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
import { FAST_TRANSFER_CONTRACTS, FTChains } from '../fastTransfer/consts';
import { ethers } from 'ethers';
import { RPCS_BY_CHAIN } from '../consts';
import { makeBlockKey } from '../databases/utils';
import TokenRouterParser from '../fastTransfer/tokenRouter/parser';
import { MarketOrder } from '../fastTransfer/types';

export type BlockTag = 'finalized' | 'safe' | 'latest';

export class FTWatcher extends Watcher {
  finalizedBlockTag: BlockTag;
  lastTimestamp: number;
  latestFinalizedBlockNumber: number;
  tokenRouterAddress: string;
  rpc: string;
  provider: ethers.providers.JsonRpcProvider;
  parser: TokenRouterParser;
  pg: Knex | null = null;

  constructor(
    network: Network,
    chain: FTChains,
    finalizedBlockTag: BlockTag = 'latest',
    isTest = false
  ) {
    super(network, chain, true);
    this.lastTimestamp = 0;
    this.latestFinalizedBlockNumber = 0;
    this.finalizedBlockTag = finalizedBlockTag;
    this.tokenRouterAddress = FAST_TRANSFER_CONTRACTS[network]?.[chain]?.TokenRouter!;
    this.provider = new ethers.providers.JsonRpcProvider(RPCS_BY_CHAIN[network][chain]);
    this.rpc = RPCS_BY_CHAIN[this.network][this.chain]!;
    this.parser = new TokenRouterParser(this.network, chain, this.provider);
    this.logger.debug('FTWatcher', network, chain, finalizedBlockTag);

    // hacky way to not connect to the db in tests
    // this is to allow ci to run without a db
    if (isTest) {
      // Components needed for testing is complete
      return;
    }

    this.pg = knex({
      client: 'pg',
      connection: {
        user: assertEnvironmentVariable('PG_FT_USER'),
        password: assertEnvironmentVariable('PG_FT_PASSWORD'),
        database: assertEnvironmentVariable('PG_FT_DATABASE'),
        host: assertEnvironmentVariable('PG_FT_HOST'),
        port: Number(assertEnvironmentVariable('PG_FT_PORT')),
      },
    });
  }

  async getResultsForBlocks(fromBlock: number, toBlock: number): Promise<string> {
    const { results, lastBlockTime } = await this.parser.getFTResultsInRange(fromBlock, toBlock);

    await this.saveFastTransfers(results);
    return makeBlockKey(toBlock.toString(), lastBlockTime.toString());
  }

  async saveFastTransfers(fastTransfers: MarketOrder[]): Promise<void> {
    // this is to allow ci to run without a db
    if (!this.pg) {
      return;
    }
    this.logger.debug(`saving ${fastTransfers.length} fast transfers`);

    // Batch insert the fast transfers
    await this.pg('market_orders').insert(fastTransfers).onConflict('fast_vaa_id').merge();
  }
}

export default FTWatcher;
