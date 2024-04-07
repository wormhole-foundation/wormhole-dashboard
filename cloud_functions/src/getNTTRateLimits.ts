import { Storage } from '@google-cloud/storage';
import { chainIdToChain } from '@wormhole-foundation/sdk-base';
import {
  NTTRateLimit,
  assertEnvironmentVariable,
} from '@wormhole-foundation/wormhole-monitor-common';
import { Gauge, register } from 'prom-client';

const outboundCapacityGauge = new Gauge({
  name: 'ntt_outbound_capacity',
  help: 'NTT outbound capacity for token on chain',
  labelNames: ['token', 'chain', 'network', 'product'],
});

const inboundCapacityGauge = new Gauge({
  name: 'ntt_inbound_capacity',
  help: 'NTT inbound capacity for token on chain from inbound_chain',
  labelNames: ['token', 'chain', 'inbound_chain', 'network', 'product'],
});

const PRODUCT = 'cloud_functions_ntt';
const AUTH_TOKEN = 'bypass_grafana_gating'; // Dummy token for Grafana Metrics Integration

async function setCapacityGauge(
  gauge: Gauge,
  labels: Record<string, string | number>,
  capacity: bigint
) {
  gauge.set(labels, Number(capacity));
}

const storage = new Storage();

let bucketName: string = 'wormhole-ntt-cache';
const network = assertEnvironmentVariable('NETWORK');
if (network === 'Testnet') {
  bucketName = 'wormhole-ntt-cache-testnet';
}

const cacheBucket = storage.bucket(bucketName);
const cacheFileName = 'ntt-rate-limits-cache.json';
const cloudStorageCache = cacheBucket.file(cacheFileName);

async function handlePrometheusMetrics(rateLimits: NTTRateLimit[]) {
  // If the request is not for JSON, return the rate limits as prometheus metrics
  // We set the gauge values for the rate limits and return using register.metrics() to get the metrics in the prometheus format
  rateLimits.forEach((tokenRateLimits) => {
    if (!tokenRateLimits.inboundCapacity) return;

    tokenRateLimits.inboundCapacity.forEach((rateLimit) => {
      if (!rateLimit || !rateLimit.amount || !rateLimit.tokenName || !rateLimit.srcChain) return;

      setCapacityGauge(
        outboundCapacityGauge,
        {
          token: rateLimit.tokenName,
          chain: chainIdToChain(rateLimit.srcChain),
          network,
          product: PRODUCT,
        },
        BigInt(rateLimit.amount)
      );

      if (!rateLimit.inboundCapacity) return;
      rateLimit.inboundCapacity.forEach((inboundRateLimit) => {
        if (
          !inboundRateLimit ||
          !inboundRateLimit.amount ||
          !inboundRateLimit.tokenName ||
          !inboundRateLimit.destChain ||
          !inboundRateLimit.srcChain
        )
          return;

        setCapacityGauge(
          inboundCapacityGauge,
          {
            token: inboundRateLimit.tokenName,
            chain: chainIdToChain(inboundRateLimit.destChain),
            inbound_chain: chainIdToChain(inboundRateLimit.srcChain),
            network,
            product: PRODUCT,
          },
          BigInt(inboundRateLimit.amount)
        );
      });
    });
  });
}

export async function getNTTRateLimits(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  // This is just a hacky way to get Grafana thinking it's authenticated
  // This doesn't provide any real security
  // Grafana Metrics Integration requires the URL to be protected by authentication.
  // Refer to: https://arc.net/l/quote/hikxnfht
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1]; // Authorization: Bearer <token>
  if (!token || token !== AUTH_TOKEN) {
    res.status(401).send('Unauthorized');
    return;
  }

  let rateLimits: NTTRateLimit[] = [];
  try {
    const [csCache] = await cloudStorageCache.download();
    rateLimits = JSON.parse(csCache.toString());

    // If the request is for JSON, return the rate limits directly
    if (req.get('Accept') === 'application/json') {
      res.json(rateLimits);
      return;
    }

    await handlePrometheusMetrics(rateLimits);
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (e) {
    console.error('Error getting rate limits: ', e);
    res.sendStatus(500);
  }
}
