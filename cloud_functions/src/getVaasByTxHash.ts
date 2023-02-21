import { Bigtable } from '@google-cloud/bigtable';
import { assertEnvironmentVariable } from './utils';

const bigtable = new Bigtable();
const instance = bigtable.instance(assertEnvironmentVariable('BIGTABLE_INSTANCE_ID'));
const vaasByTxHashTable = instance.table(
  assertEnvironmentVariable('BIGTABLE_VAAS_BY_TX_HASH_TABLE_ID')
);
const signedVAAsTable = instance.table(assertEnvironmentVariable('BIGTABLE_SIGNED_VAAS_TABLE_ID'));

export async function getVaasByTxHash(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.sendStatus(204);
    return;
  }
  try {
    const txHash = req.query.tx;
    if (!txHash) {
      res.status(400);
      res.json({ error: 'tx param is required' });
      return;
    }
    const txHashKey = `${txHash}/`;
    const txHashRows = await vaasByTxHashTable.getRows({ prefix: txHashKey, limit: 1 });
    if (txHashRows[0].length === 0) {
      res.status(404);
      res.json({ error: 'tx not found' });
      return;
    }
    const vaaKeys = JSON.parse(txHashRows[0][0].data.info.vaaKeys[0].value || []);
    if (vaaKeys.length === 0) {
      res.status(404);
      res.json({ error: 'tx has no VAAs' });
      return;
    }
    const signedVAAs = await signedVAAsTable.getRows({ keys: vaaKeys, decode: false });
    const result = vaaKeys.map((vaaKey: string) => {
      const row = signedVAAs[0].find((row) => row.id.toString() === vaaKey);
      const vaaBytes = row ? row.data.info.bytes[0].value.toString('hex') : null;
      return {
        id: vaaKey,
        vaaBytes,
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500);
    res.end();
  }
}
