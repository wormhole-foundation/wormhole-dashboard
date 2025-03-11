import {
  assertEnvironmentVariable,
  formatAndSendToSlack,
  SlackInfo,
} from '@wormhole-foundation/wormhole-monitor-common';
import knex, { Knex } from 'knex';

let alarmSlackInfo: SlackInfo;
let initialized = false;
let pg: Knex;

function initialize() {
  pg = knex({
    client: 'pg',
    connection: {
      user: assertEnvironmentVariable('PG_USER'),
      password: assertEnvironmentVariable('PG_PASSWORD'),
      database: assertEnvironmentVariable('PG_FT_DATABASE'),
      host: assertEnvironmentVariable('PG_HOST'),
    },
  });
  console.log(`database = ${assertEnvironmentVariable('PG_FT_DATABASE')}`);

  alarmSlackInfo = {
    channelId: assertEnvironmentVariable('FT_MISSING_VAA_SLACK_CHANNEL_ID'),
    postUrl: assertEnvironmentVariable('MISSING_VAA_SLACK_POST_URL'),
    botToken: assertEnvironmentVariable('MISSING_VAA_SLACK_BOT_TOKEN'),
    bannerTxt: 'Wormhole Fast Transfer Alarm',
    msg: '',
  };
  console.log(`channelId = ${assertEnvironmentVariable('FT_MISSING_VAA_SLACK_CHANNEL_ID')}`);
  console.log('initialized global variables');
  initialized = true;
}

export async function alarmFastTransfer(req: any, res: any) {
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
    if (!initialized) {
      initialize();
    }

    // Get the last 30 minutes of delayed orders.
    // In this case, delayed means the execution time is greater than 20 seconds.
    // This cloud function is scheduled to run every 30 minutes.
    const alertOrders: DisplayRow[] = await getDelayedOrders();
    for (const order of alertOrders) {
      const formattedAmountIn = formatBigInt(order.amountIn);
      const formattedAmountOut = formatBigInt(order.amountOut);
      alarmSlackInfo.msg =
        `🚨 Delayed Order Alert!\n` +
        `Source Chain: ${order.sourceChain}\n` +
        `Sequence: ${order.sequence}\n` +
        `Status: ${order.status}\n` +
        `Order Timestamp: ${order.market_order_timestamp.toISOString()}\n` +
        `Destination Chain: ${order.destinationChain}\n` +
        `Execution Time: ${order.executionTime} Sec\n` +
        `Amount In: ${formattedAmountIn}\n` +
        `Amount Out: ${formattedAmountOut}`;
      console.log(alarmSlackInfo.msg);
      await formatAndSendToSlack(alarmSlackInfo);
    }
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
  res.status(200).send('successfully alarmed delayed fast transfers');
  return;
}

// Format the amount in bigint to a string with 2 decimal places.
// We know that the bigint input is fixed 6 decimal places and we only need to show 2 decimal places.
const formatBigInt = (amt: bigint) => {
  const str = (amt / 10_000n).toString().padStart(3, '0');
  return str.substring(0, str.length - 2) + '.' + str.substring(str.length - 2);
};

async function getDelayedOrders(): Promise<DisplayRow[]> {
  console.log('getDelayedOrders');
  const result = await pg
    .select(
      'mo.fast_vaa_id',
      'mo.status',
      'mo.market_order_timestamp',
      'mo.dst_chain AS destinationChain',
      pg.raw(
        'EXTRACT(EPOCH FROM (fte.execution_time - mo.market_order_timestamp)) AS "executionTime"'
      ),
      'mo.amount_in AS amountIn',
      'fte.user_amount'
    )
    .from('market_orders AS mo')
    .join('fast_transfer_executions AS fte', 'mo.fast_vaa_hash', '=', 'fte.fast_vaa_hash')
    .where('mo.market_order_timestamp', '>=', pg.raw("NOW() - INTERVAL '30 MINUTES'")) // Get orders from last 30 minutes
    .andWhereRaw('EXTRACT(EPOCH FROM (fte.execution_time - mo.market_order_timestamp)) > 20')
    .orderBy('mo.market_order_timestamp', 'desc');

  console.log('result', result);
  return result.map((row) => ({
    sourceChain: row.fast_vaa_id.split('/')[0],
    sequence: row.fast_vaa_id.split('/')[2],
    status: row.status,
    market_order_timestamp: row.market_order_timestamp,
    destinationChain: row.destinationChain,
    executionTime: row.executionTime,
    amountIn: BigInt(row.amountIn),
    amountOut: BigInt(row.user_amount),
  }));
}

type DisplayRow = {
  sourceChain: number; // from fast_vaa_id
  sequence: bigint; // from fast_vaa_id
  status: string; // from MarketOrder
  market_order_timestamp: Date; // from MarketOrder
  destinationChain: number; // from MarketOrder
  executionTime: number; // execution_time - market_order_timestamp
  amountIn: bigint; // from MarketOrder
  amountOut: bigint; // from FastTransferExecutions
};
