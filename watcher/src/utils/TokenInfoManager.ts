import { Knex } from 'knex';
import { ethers, providers } from 'ethers';
import { ChainId, chainIdToChain } from '@wormhole-foundation/sdk-base';
import { Connection, PublicKey } from '@solana/web3.js';
import { TokenInfo } from 'src/fastTransfer/types';

const minABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
];
// TokenInfoManager class for managing token information across different chains
// This class is to ensure that token info (e.g. decimal, name) for tokens that we see on Swap Layer is persisted for analytics purposes
export class TokenInfoManager {
  private tokenInfoMap: Map<string, TokenInfo>;
  private db: Knex;
  private chainId: ChainId;
  private provider: providers.JsonRpcProvider | Connection;

  constructor(db: Knex, chainId: ChainId, provider: providers.JsonRpcProvider | Connection) {
    this.tokenInfoMap = new Map();
    this.db = db;
    this.chainId = chainId;
    this.provider = provider;
  }

  // Retrieve token information from the database
  private async getTokenInfoFromDB(tokenAddress: string): Promise<TokenInfo | null> {
    return await this.db('token_infos')
      .select('token_address', 'name', 'symbol', 'decimals')
      .where('token_address', tokenAddress)
      .andWhere('chain_id', this.chainId)
      .first();
  }

  private async saveTokenInfo(tokenAddress: string, tokenInfo: TokenInfo): Promise<void> {
    await this.db('token_infos')
      .insert({
        token_address: tokenAddress,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        chain_id: this.chainId,
      })
      .onConflict(['token_address', 'chain_id'])
      .merge();
  }

  // Save token information if it doesn't exist in the cache or database
  public async saveTokenInfoIfNotExist(tokenAddress: string): Promise<TokenInfo | null> {
    if (this.tokenInfoMap.has(tokenAddress)) {
      return this.tokenInfoMap.get(tokenAddress) || null;
    }
    // Check if token info is in the database
    const tokenInfo = await this.getTokenInfoFromDB(tokenAddress);
    if (tokenInfo) {
      this.tokenInfoMap.set(tokenAddress, tokenInfo);
      return tokenInfo;
    }
    // If not in database, fetch from RPC
    const fetchedTokenInfo = await this.fetchTokenInfoFromRPC(tokenAddress);
    if (fetchedTokenInfo) {
      await this.saveTokenInfo(tokenAddress, fetchedTokenInfo);
      this.tokenInfoMap.set(tokenAddress, fetchedTokenInfo);
      return fetchedTokenInfo;
    }
    return null;
  }

  // Fetch token information from RPC based on the chain ID
  private async fetchTokenInfoFromRPC(tokenAddress: string): Promise<TokenInfo | null> {
    if (chainIdToChain(this.chainId) === 'Solana') {
      return this.fetchSolanaTokenInfo(tokenAddress);
    }
    return this.fetchEVMTokenInfo(tokenAddress);
  }

  // Fetch Solana token information
  private async fetchSolanaTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      const connection = this.provider as Connection;
      const tokenPublicKey = new PublicKey(tokenAddress);
      const accountInfo = await connection.getParsedAccountInfo(tokenPublicKey);

      if (accountInfo.value && accountInfo.value.data && 'parsed' in accountInfo.value.data) {
        const parsedData = accountInfo.value.data.parsed;
        if (parsedData.type === 'mint' && 'info' in parsedData) {
          const { name, symbol, decimals } = parsedData.info;
          if (
            typeof name === 'string' &&
            typeof symbol === 'string' &&
            typeof decimals === 'number'
          ) {
            return { name, symbol, decimals, chain_id: this.chainId, token_address: tokenAddress };
          }
        }
      }
      throw new Error('Invalid token account');
    } catch (error) {
      console.error('Error fetching Solana token info:', error);
      return null;
    }
  }

  // Fetch EVM token information
  private async fetchEVMTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    // If it's null address, it's Ether or Wrapped Ether
    if (tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      const { name, symbol } = this.getEtherInfo();
      return {
        name,
        symbol,
        decimals: 18,
        chain_id: this.chainId,
        token_address: tokenAddress,
      };
    }

    const provider = this.provider as providers.JsonRpcProvider;
    const tokenContract = new ethers.Contract(tokenAddress, minABI, provider);
    try {
      const name = await tokenContract.name();
      const symbol = await tokenContract.symbol();
      const decimals = await tokenContract.decimals();
      return { name, symbol, decimals, chain_id: this.chainId, token_address: tokenAddress };
    } catch (error) {
      console.error('Error fetching EVM token info:', error, tokenAddress);
      return null;
    }
  }

  // Helper function to get Ether or Wrapped Ether info based on chain ID
  private getEtherInfo(): { name: string; symbol: string } {
    switch (this.chainId) {
      case 2:
      case 5:
        return { name: 'Ether', symbol: 'ETH' };
      default:
        return { name: 'Wrapped Ether', symbol: 'WETH' };
    }
  }
}
