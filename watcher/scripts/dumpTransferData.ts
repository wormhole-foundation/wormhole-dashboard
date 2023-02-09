console.error('This transfer information is no longer available in BigTable.');

// import * as dotenv from 'dotenv';
// dotenv.config();
// import { open } from 'fs/promises';
// import { BigtableDatabase } from '../src/databases/BigtableDatabase';
// import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';
// import {
//   ChainId,
//   CHAINS,
//   CHAIN_ID_ACALA,
//   CHAIN_ID_ALGORAND,
//   CHAIN_ID_APTOS,
//   CHAIN_ID_ARBITRUM,
//   CHAIN_ID_AURORA,
//   CHAIN_ID_AVAX,
//   CHAIN_ID_BSC,
//   CHAIN_ID_CELO,
//   CHAIN_ID_ETH,
//   CHAIN_ID_FANTOM,
//   CHAIN_ID_INJECTIVE,
//   CHAIN_ID_KARURA,
//   CHAIN_ID_KLAYTN,
//   CHAIN_ID_MOONBEAM,
//   CHAIN_ID_NEAR,
//   CHAIN_ID_OASIS,
//   CHAIN_ID_OPTIMISM,
//   CHAIN_ID_POLYGON,
//   CHAIN_ID_PYTHNET,
//   CHAIN_ID_SOLANA,
//   CHAIN_ID_TERRA,
//   CHAIN_ID_TERRA2,
//   CHAIN_ID_UNSET,
//   CHAIN_ID_XPLA,
//   coalesceChainName,
// } from '@certusone/wormhole-sdk/lib/cjs/utils/consts';
// import ora from 'ora';
// import { BigtableVAAsResultRow } from '../src/databases/types';

// // This script dumps all VAAs to a csv file compatible with the guardian `sign-existing-vaas-csv` admin command

// const LIMIT = 10000;

// const knownTokenbridgeEmitters: { [id in ChainId]?: string } = {
//   [CHAIN_ID_SOLANA]:
//     'ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5'.toLowerCase(),
//   [CHAIN_ID_ETH]: '0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585'.toLowerCase(),
//   [CHAIN_ID_TERRA]:
//     '0000000000000000000000007cf7b764e38a0a5e967972c1df77d432510564e2'.toLowerCase(),
//   [CHAIN_ID_TERRA2]:
//     'a463ad028fb79679cfc8ce1efba35ac0e77b35080a1abe9bebe83461f176b0a3'.toLowerCase(),
//   [CHAIN_ID_BSC]: '000000000000000000000000b6f6d86a8f9879a9c87f643768d9efc38c1da6e7'.toLowerCase(),
//   [CHAIN_ID_POLYGON]:
//     '0000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde'.toLowerCase(),
//   [CHAIN_ID_AVAX]: '0000000000000000000000000e082f06ff657d94310cb8ce8b0d9a04541d8052'.toLowerCase(),
//   [CHAIN_ID_OASIS]:
//     '0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564'.toLowerCase(),
//   [CHAIN_ID_ALGORAND]:
//     '67e93fa6c8ac5c819990aa7340c0c16b508abb1178be9b30d024b8ac25193d45'.toLowerCase(),
//   [CHAIN_ID_APTOS]:
//     '0000000000000000000000000000000000000000000000000000000000000001'.toLowerCase(),
//   [CHAIN_ID_AURORA]:
//     '00000000000000000000000051b5123a7b0F9b2bA265f9c4C8de7D78D52f510F'.toLowerCase(),
//   [CHAIN_ID_FANTOM]:
//     '0000000000000000000000007C9Fc5741288cDFdD83CeB07f3ea7e22618D79D2'.toLowerCase(),
//   [CHAIN_ID_KARURA]:
//     '000000000000000000000000ae9d7fe007b3327AA64A32824Aaac52C42a6E624'.toLowerCase(),
//   [CHAIN_ID_ACALA]:
//     '000000000000000000000000ae9d7fe007b3327AA64A32824Aaac52C42a6E624'.toLowerCase(),
//   [CHAIN_ID_KLAYTN]:
//     '0000000000000000000000005b08ac39EAED75c0439FC750d9FE7E1F9dD0193F'.toLowerCase(),
//   [CHAIN_ID_CELO]: '000000000000000000000000796Dff6D74F3E27060B71255Fe517BFb23C93eed'.toLowerCase(),
//   [CHAIN_ID_NEAR]: '148410499d3fcda4dcfd68a1ebfcdddda16ab28326448d4aae4d2f0465cdfcb7'.toLowerCase(),
//   [CHAIN_ID_MOONBEAM]:
//     '000000000000000000000000B1731c586ca89a23809861c6103F0b96B3F57D92'.toLowerCase(),
//   [CHAIN_ID_ARBITRUM]:
//     '0000000000000000000000000b2402144Bb366A632D14B83F244D2e0e21bD39c'.toLowerCase(),
//   [CHAIN_ID_OPTIMISM]:
//     '0000000000000000000000001D68124e65faFC907325e3EDbF8c4d84499DAa8b'.toLowerCase(),
//   [CHAIN_ID_XPLA]: '8f9cf727175353b17a5f574270e370776123d90fd74956ae4277962b4fdee24c'.toLowerCase(),
//   [CHAIN_ID_INJECTIVE]:
//     '00000000000000000000000045dbea4617971d93188eda21530bc6503d153313'.toLowerCase(),
// };

// (async () => {
//   const fd = await open(`transfers-${new Date().toISOString()}.csv`, 'w');
//   try {
//     const bt = new BigtableDatabase();
//     if (!bt.bigtable) {
//       throw new Error('bigtable is undefined');
//     }
//     const vaaTableId = assertEnvironmentVariable('BIGTABLE_VAA_TABLE_ID');
//     const instance = bt.bigtable.instance(bt.instanceId);
//     const vaaTable = instance.table(vaaTableId);
//     const filter = [
//       {
//         family: 'MessagePublication',
//         column: 'EmitterChain',
//       },
//       {
//         family: 'MessagePublication',
//         column: 'EmitterAddress',
//       },
//       {
//         family: 'MessagePublication',
//         column: 'Sequence',
//       },
//       {
//         family: 'MessagePublication',
//         column: 'Timestamp',
//       },
//       {
//         family: 'TokenTransferPayload',
//         column: 'OriginChain',
//       },
//       {
//         family: 'TokenTransferPayload',
//         column: 'OriginAddress',
//       },
//       {
//         family: 'TokenTransferPayload',
//         column: 'TargetChain',
//       },
//       {
//         family: 'TokenTransferPayload',
//         column: 'TargetAddress',
//       },
//       {
//         family: 'TokenTransferPayload',
//         column: 'Amount',
//       },
//       {
//         family: 'TokenTransferDetails',
//         column: 'NotionalUSD',
//       },
//       {
//         family: 'TokenTransferDetails',
//         column: 'OriginSymbol',
//       },
//       {
//         family: 'TokenTransferDetails',
//         column: 'OriginName',
//       },
//       {
//         family: 'TokenTransferDetails',
//         column: 'OriginTokenAddress',
//       },
//     ];
//     await fd.write(`ID,${filter.map((f) => f.column).join(',')}\n`);
//     const chains = Object.keys(knownTokenbridgeEmitters).map((c) => Number(c) as ChainId);
//     for (const chain of chains) {
//       const chainName = coalesceChainName(chain);
//       let total = 0;
//       let log = ora(`Fetching all ${chainName} VAAs...`).start();
//       let start = `${chain}:${knownTokenbridgeEmitters[chain]}:`;
//       while (start) {
//         log.text = `Fetching ${LIMIT}/${total} ${chainName} VAAs starting at ${start}...`;
//         let vaaRows = (
//           await vaaTable.getRows({
//             start,
//             end: `${chain}:${knownTokenbridgeEmitters[chain]}:z`,
//             decode: false,
//             // filter, // TODO: why does this break it
//             limit: LIMIT,
//           })
//         )[0];
//         start = vaaRows.length === LIMIT ? vaaRows[LIMIT - 1].id : '';
//         vaaRows = vaaRows.filter((row) => row.id.toString() !== start.toString());
//         total += vaaRows.length;
//         log.text = `Processing ${total} ${chainName} VAAs...`;
//         for (const row of vaaRows) {
//           // TODO: filter out attestations
//           try {
//             await fd.write(
//               `${row.id},${filter
//                 .map((f) => {
//                   const v = row.data[f.family]?.[f.column]?.[0].value;
//                   return f.column === 'NotionalUSD' && Buffer.isBuffer(v)
//                     ? new DataView(new Uint8Array(v).buffer).getFloat64(0).toString()
//                     : v?.toString().replaceAll(',', '');
//                 })
//                 .join(',')}\n`
//             );
//           } catch (e) {
//             console.error(e);
//           }
//         }
//       }
//       log.succeed(`Processed ${total} ${chainName} VAAs...`);
//     }
//   } catch (e) {
//     console.error(e);
//   } finally {
//     await fd.close();
//   }
// })();
