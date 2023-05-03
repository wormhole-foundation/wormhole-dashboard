import {
  ChainId,
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_APTOS,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_CELO,
  CHAIN_ID_ETH,
  CHAIN_ID_FANTOM,
  CHAIN_ID_INJECTIVE,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_MOONBEAM,
  CHAIN_ID_NEAR,
  CHAIN_ID_OASIS,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_POLYGON,
  CHAIN_ID_PYTHNET,
  CHAIN_ID_SOLANA,
  CHAIN_ID_SUI,
  CHAIN_ID_TERRA,
  CHAIN_ID_TERRA2,
  CHAIN_ID_XPLA,
} from '@certusone/wormhole-sdk';
import acalaIcon from '../images/acala.svg';
import algorandIcon from '../images/algorand.svg';
import aptosIcon from '../images/aptos.svg';
import arbitrumIcon from '../images/arbitrum.svg';
import auroraIcon from '../images/aurora.svg';
import avaxIcon from '../images/avax.svg';
import bscIcon from '../images/bsc.svg';
import celoIcon from '../images/celo.svg';
import ethIcon from '../images/eth.svg';
import fantomIcon from '../images/fantom.svg';
import injectiveIcon from '../images/injective.svg';
import karuraIcon from '../images/karura.svg';
import klaytnIcon from '../images/klaytn.svg';
import nearIcon from '../images/near.svg';
import oasisIcon from '../images/oasis-network-rose-logo.svg';
import optimismIcon from '../images/optimism.svg';
import polygonIcon from '../images/polygon.svg';
import solanaIcon from '../images/solana.svg';
import suiIcon from '../images/sui.svg';
import terraIcon from '../images/terra.svg';
import terra2Icon from '../images/terra2.svg';
import xplaIcon from '../images/xpla.svg';
import moonbeamIcon from '../images/moonbeam.svg';
import pythnetIcon from '../images/pyth_logomark_white.svg';

require('dotenv').config();

export const WORMCHAIN_URL = 'https://wormchain.jumpisolated.com';

export type CHAIN_INFO = {
  name: string;
  evm: boolean;
  chainId: ChainId;
  endpointUrl: any;
  explorerStem: string;
  icon?: string;
};

export const CHAIN_INFO_MAP: { [key: string]: CHAIN_INFO } = {
  1: {
    name: 'solana',
    evm: false,
    chainId: CHAIN_ID_SOLANA,
    endpointUrl: process.env.REACT_APP_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
    explorerStem: `https://solscan.io`,
    icon: solanaIcon,
  },
  2: {
    name: 'eth',
    evm: true,
    chainId: CHAIN_ID_ETH,
    endpointUrl: process.env.REACT_APP_ETH_RPC || 'https://rpc.ankr.com/eth',
    explorerStem: `https://etherscan.io`,
    icon: ethIcon,
  },
  3: {
    name: 'terra',
    evm: false,
    chainId: CHAIN_ID_TERRA,
    endpointUrl: '',
    explorerStem: `https://finder.terra.money/classic`,
    icon: terraIcon,
  },
  4: {
    name: 'bsc',
    evm: true,
    chainId: CHAIN_ID_BSC,
    endpointUrl: process.env.REACT_APP_BSC_RPC || 'https://bsc-dataseed2.defibit.io',
    explorerStem: `https://bscscan.com`,
    icon: bscIcon,
  },
  5: {
    name: 'polygon',
    evm: true,
    chainId: CHAIN_ID_POLYGON,
    endpointUrl: process.env.REACT_APP_POLYGON_RPC || 'https://polygon-rpc.com',
    explorerStem: `https://polygonscan.com`,
    icon: polygonIcon,
  },
  6: {
    name: 'avalanche',
    evm: true,
    chainId: CHAIN_ID_AVAX,
    endpointUrl: process.env.REACT_APP_AVAX_RPC || 'https://api.avax.network/ext/bc/C/rpc',
    explorerStem: `https://snowtrace.io`,
    icon: avaxIcon,
  },
  7: {
    name: 'oasis',
    evm: true,
    chainId: CHAIN_ID_OASIS,
    endpointUrl: 'https://emerald.oasis.dev',
    explorerStem: `https://explorer.emerald.oasis.dev`,
    icon: oasisIcon,
  },
  8: {
    name: 'algorand',
    evm: false,
    chainId: CHAIN_ID_ALGORAND,
    endpointUrl: 'https://node.algoexplorerapi.io',
    explorerStem: `https://algoexplorer.io`,
    icon: algorandIcon,
  },
  9: {
    name: 'aurora',
    evm: true,
    chainId: CHAIN_ID_AURORA,
    endpointUrl: 'https://mainnet.aurora.dev',
    explorerStem: `https://aurorascan.dev`,
    icon: auroraIcon,
  },
  10: {
    name: 'fantom',
    evm: true,
    chainId: CHAIN_ID_FANTOM,
    endpointUrl: 'https://rpc.ftm.tools',
    explorerStem: `https://ftmscan.com`,
    icon: fantomIcon,
  },
  11: {
    name: 'karura',
    evm: true,
    chainId: CHAIN_ID_KARURA,
    endpointUrl: 'https://eth-rpc-karura.aca-api.network',
    explorerStem: `https://blockscout.karura.network`,
    icon: karuraIcon,
  },
  12: {
    name: 'acala',
    evm: true,
    chainId: CHAIN_ID_ACALA,
    endpointUrl: 'https://eth-rpc-acala.aca-api.network',
    explorerStem: `https://blockscout.acala.network`,
    icon: acalaIcon,
  },
  13: {
    name: 'klaytn',
    evm: true,
    chainId: CHAIN_ID_KLAYTN,
    endpointUrl: 'https://klaytn-mainnet-rpc.allthatnode.com:8551',
    explorerStem: `https://scope.klaytn.com`,
    icon: klaytnIcon,
  },
  14: {
    name: 'celo',
    evm: true,
    chainId: CHAIN_ID_CELO,
    endpointUrl: 'https://forno.celo.org',
    explorerStem: `https://explorer.celo.org`,
    icon: celoIcon,
  },
  15: {
    name: 'near',
    evm: false,
    chainId: CHAIN_ID_NEAR,
    endpointUrl: '',
    explorerStem: `https://explorer.near.org`,
    icon: nearIcon,
  },
  16: {
    name: 'moonbeam',
    evm: true,
    chainId: CHAIN_ID_MOONBEAM,
    endpointUrl: 'https://rpc.ankr.com/moonbeam',
    explorerStem: `https://moonscan.io`,
    icon: moonbeamIcon,
  },
  18: {
    name: 'terra2',
    evm: false,
    chainId: CHAIN_ID_TERRA2,
    endpointUrl: '',
    explorerStem: `https://finder.terra.money/mainnet`,
    icon: terra2Icon,
  },
  19: {
    name: 'injective',
    evm: false,
    chainId: CHAIN_ID_INJECTIVE,
    endpointUrl: '',
    explorerStem: `https://explorer.injective.network`,
    icon: injectiveIcon,
  },
  21: {
    name: 'sui',
    evm: false,
    chainId: CHAIN_ID_SUI,
    endpointUrl: 'https://rpc.mainnet.sui.io',
    explorerStem: `https://explorer.sui.io`,
    icon: suiIcon,
  },
  22: {
    name: 'aptos',
    evm: false,
    chainId: CHAIN_ID_APTOS,
    endpointUrl: 'https://fullnode.mainnet.aptoslabs.com/v1',
    explorerStem: `https://explorer.aptoslabs.com`,
    icon: aptosIcon,
  },
  23: {
    name: 'arbitrum',
    evm: true,
    chainId: CHAIN_ID_ARBITRUM,
    endpointUrl: 'https://arb1.arbitrum.io/rpc',
    explorerStem: `https://arbiscan.io`,
    icon: arbitrumIcon,
  },
  24: {
    name: 'optimism',
    evm: true,
    chainId: CHAIN_ID_OPTIMISM,
    endpointUrl: 'https://rpc.ankr.com/optimism',
    explorerStem: `https://optimistic.etherscan.io`,
    icon: optimismIcon,
  },
  26: {
    name: 'pythnet',
    evm: false,
    chainId: CHAIN_ID_PYTHNET,
    endpointUrl: '',
    explorerStem: '',
    icon: pythnetIcon,
  },
  28: {
    name: 'xpla',
    evm: false,
    chainId: CHAIN_ID_XPLA,
    endpointUrl: 'https://dimension-lcd.xpla.dev',
    explorerStem: `https://explorer.xpla.io`,
    icon: xplaIcon,
  },
};

export const JUMP_GUARDIAN_ADDRESS = '58cc3ae5c097b213ce3c81979e1b9f9570746aa5';
export const ACCOUNTANT_CONTRACT_ADDRESS =
  'wormhole14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9srrg465';

export const GUARDIAN_SET_3 = [
  {
    pubkey: '0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5',
    name: 'Jump Crypto',
  },
  {
    pubkey: '0xfF6CB952589BDE862c25Ef4392132fb9D4A42157',
    name: 'Staked',
  },
  {
    pubkey: '0x114De8460193bdf3A2fCf81f86a09765F4762fD1',
    name: 'Figment',
  },
  {
    pubkey: '0x107A0086b32d7A0977926A205131d8731D39cbEB',
    name: 'ChainodeTech',
  },
  {
    pubkey: '0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2',
    name: 'Inotel',
  },
  {
    pubkey: '0x11b39756C042441BE6D8650b69b54EbE715E2343',
    name: 'HashQuark',
  },
  {
    pubkey: '0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd',
    name: 'Chainlayer',
  },
  {
    pubkey: '0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20',
    name: 'xLabs',
  },
  {
    pubkey: '0x74a3bf913953D695260D88BC1aA25A4eeE363ef0',
    name: 'Forbole',
  },
  {
    pubkey: '0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e',
    name: 'Staking Fund',
  },
  {
    pubkey: '0xAF45Ced136b9D9e24903464AE889F5C8a723FC14',
    name: 'MoonletWallet',
  },
  {
    pubkey: '0xf93124b7c738843CBB89E864c862c38cddCccF95',
    name: 'P2P Validator',
  },
  {
    pubkey: '0xD2CC37A4dc036a8D232b48f62cDD4731412f4890',
    name: '01Node',
  },
  {
    pubkey: '0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811',
    name: 'MCF',
  },
  {
    pubkey: '0x71AA1BE1D36CaFE3867910F99C09e347899C19C3',
    name: 'Everstake',
  },
  {
    pubkey: '0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf',
    name: 'Chorus One',
  },
  {
    pubkey: '0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8',
    name: 'Syncnode',
  },
  {
    pubkey: '0x5E1487F35515d02A92753504a8D75471b9f49EdB',
    name: 'Triton',
  },
  {
    pubkey: '0x6FbEBc898F403E4773E95feB15E80C9A99c8348d',
    name: 'Staking Facilities',
  },
];
