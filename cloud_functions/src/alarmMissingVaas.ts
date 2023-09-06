import { CHAIN_ID_TO_NAME, ChainId, ChainName } from '@certusone/wormhole-sdk';
import { MissingVaasByChain, commonGetMissingVaas } from './getMissingVaas';
import { formatAndSendToSlack } from './utils';
import { ObservedMessage } from './types';
import { explorerBlock, explorerTx } from '@wormhole-foundation/wormhole-monitor-common';

export async function alarmMissingVaas(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  try {
    // attempting to retrieve missing VAAs...
    const messages: MissingVaasByChain = await commonGetMissingVaas();
    if (messages) {
      const now = new Date();
      now.setHours(now.getHours() - 2);
      const twoHoursAgo = now.toISOString();
      for (const chain of Object.keys(messages)) {
        const chainId = chain as unknown as ChainId;
        const msgs = messages[chainId];
        if (msgs && msgs.messages) {
          for (let i = 0; i < msgs.messages.length; i++) {
            // Check the timestamp and only send messages that are older than 2 hours
            if (msgs.messages[i].timestamp < twoHoursAgo) {
              await formatAndSendToSlack(formatMessage(msgs.messages[i]));
            }
          }
        } else {
          console.log('skipping over messages for chain', chainId);
        }
      }
    }
  } catch (e) {
    console.log('could not get missing VAAs', e);
    res.sendStatus(500);
  }
  res.status(200).send('successfully alarmed missing VAAS');
  return;
}

function formatMessage(msg: ObservedMessage): string {
  const cName: string = CHAIN_ID_TO_NAME[msg.chain as ChainId] as ChainName;
  // const vaaKeyUrl: string = `https://wormhole.com/explorer/?emitterChain=${msg.chain}&emitterAddress=${msg.emitter}&sequence=${msg.seq}`;
  const vaaKeyUrl: string = `https://wormholescan.io/#/tx/${msg.chain}/${msg.emitter}/${msg.seq}`;
  const txHashUrl: string = explorerTx(msg.chain as ChainId, msg.txHash);
  const blockUrl: string = explorerBlock(msg.chain as ChainId, msg.block.toString());
  const formattedMsg = `*Chain:* ${cName}(${msg.chain})\n*TxHash:* <${txHashUrl}|${msg.txHash}>\n*VAA Key:* <${vaaKeyUrl}|${msg.chain}/${msg.emitter}/${msg.seq}> \n*Block:* <${blockUrl}|${msg.block}> \n*Timestamp:* ${msg.timestamp}`;
  return formattedMsg;
}
