import { Network, networks } from '@wormhole-foundation/sdk-base';
import { EvmChains } from '@wormhole-foundation/sdk-evm';

// This data structure is used in dashboard
export type NTTContract = {
  [key in Network]: { [tokenName: string]: { [key in NTTChain]?: string } };
};

// This data structure is used in watchers
export type NTTContractArray = {
  [key in Network]: { [key in NTTChain]?: string[] };
};

export const nttChains = [
  'Ethereum',
  'Fantom',
  'Solana',
  'Arbitrum',
  'Optimism',
  'Base',
  'Sepolia',
  'ArbitrumSepolia',
  'BaseSepolia',
  'OptimismSepolia',
  'Holesky',
] as const;

function convertNTTManagerContractToNTTContractArray(
  nttManagerContract: NTTContract
): NTTContractArray {
  const nttContract: NTTContractArray = {} as NTTContractArray;

  for (const network of networks) {
    nttContract[network] = {};

    for (const tokenName in nttManagerContract[network]) {
      for (const chain of nttChains) {
        const tokenAddress = nttManagerContract[network][tokenName][chain];

        if (tokenAddress) {
          if (!nttContract[network][chain]) {
            nttContract[network][chain] = [];
          }
          nttContract[network][chain]!.push(tokenAddress);
        }
      }
    }
  }

  return nttContract;
}

export const NTT_MANAGER_CONTRACT: NTTContract = {
  Mainnet: {
    USDC: {
      Ethereum: '0xeBdCe9a913d9400EE75ef31Ce8bd34462D01a1c1',
      Fantom: '0x68dB2f05Aa2d77DEf981fd2be32661340c9222FB',
    },
    W: {
      Solana: 'NTtAaoDJhkeHeaVUHnyhwbPNAN6WgBpHkHBTc6d7vLK',
      Ethereum: '0xc072B1AEf336eDde59A049699Ef4e8Fa9D594A48',
      Arbitrum: '0x5333d0AcA64a450Add6FeF76D6D1375F726CB484',
      Optimism: '0x1a4F1a790f23Ffb9772966cB6F36dCd658033e13',
      Base: '0x5333d0AcA64a450Add6FeF76D6D1375F726CB484',
    },
  },
  Testnet: {
    TEST_NTT: {
      Solana: 'nTTh3bZ5Aer6xboWZe39RDEft4MeVxSQ8D1EYAVLZw9',
      Sepolia: '0xB231aD95f2301bc82eA44c515001F0F746D637e0',
      ArbitrumSepolia: '0xEec94CD3083e067398256a79CcA7e740C5c8ef81',
      BaseSepolia: '0xB03b030b2f5B40819Df76467d67eD1C85Ff66fAD',
      OptimismSepolia: '0x7f430D4e7939D994C0955A01FC75D9DE33F12D11',
    },
  },
  Devnet: {},
};

export const NTT_TRANSCEIVER_CONTRACT: NTTContract = {
  Mainnet: {
    USDC: {
      Ethereum: '0x55f7820357FA17A1ECb48E959D5E637bFF956d6F',
      Fantom: '0x8b47f02E7E20174C76Af910adc0Ad8A4B0342f4c',
    },
    W: {
      Solana: 'ExVbjD8inGXkt7Cx8jVr4GF175sQy1MeqgfaY53Ah8as',
      Ethereum: '0xDb55492d7190D1baE8ACbE03911C4E3E7426870c',
      Arbitrum: '0xD1a8AB69e00266e8B791a15BC47514153A5045a6',
      Optimism: '0x9bD8b7b527CA4e6738cBDaBdF51C22466756073d',
      Base: '0xD1a8AB69e00266e8B791a15BC47514153A5045a6',
    },
  },
  Testnet: {
    TEST_NTT: {
      Solana: '9WNzy7xYZyL2k6JnE9dWSp7VpYkvfRN3Rhd8wHv9J9mY',
      Sepolia: '0x1fDC902e30b188FD2BA976B421Cb179943F57896',
      ArbitrumSepolia: '0x0E24D17D7467467b39Bf64A9DFf88776Bd6c74d7',
      BaseSepolia: '0x1e072169541f1171e427Aa44B5fd8924BEE71b0e',
      OptimismSepolia: '0x41265eb2863bf0238081F6AeefeF73549C82C3DD',
    },
  },
  Devnet: {},
};

export const NTT_TOKENS: NTTContract = {
  Mainnet: {
    USDC: {
      Ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      Fantom: '0x2F733095B80A04b38b0D10cC884524a3d09b836a',
    },
    W: {
      Solana: '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ',
      Ethereum: '0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91',
      Arbitrum: '0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91',
      Optimism: '0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91',
      Base: '0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91',
    },
  },
  Testnet: {
    TEST_NTT: {
      Solana: '87r5ZS91Q2pQbFTvvneqs7y7mbtegtqMt4LDAS4g23Ax',
      Sepolia: '0x1d30E78B7C7fbbcef87ae6e97B5389b2e470CA4a',
      ArbitrumSepolia: '0x84A1Cb660B19eB0063EE5FD377eC14AAe3364d74',
      BaseSepolia: '0x7f430D4e7939D994C0955A01FC75D9DE33F12D11',
      OptimismSepolia: '0x0e15979a7a1eFAEf20312CA45A59eb141bF7E340',
    },
  },
  Devnet: {},
};

export type NTTChain = (typeof nttChains)[number];

export type NTTEvmChain = NTTChain & EvmChains;

export const NTT_MANAGER_CONTRACT_ARRAY =
  convertNTTManagerContractToNTTContractArray(NTT_MANAGER_CONTRACT);

export function NTT_SUPPORTED_CHAINS(network: Network, token: string): NTTChain[] {
  const contractDetails = NTT_MANAGER_CONTRACT[network][token];
  if (!contractDetails) {
    return [];
  }

  return nttChains.filter((chain) => chain in contractDetails);
}
