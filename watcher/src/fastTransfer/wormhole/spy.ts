import {
  ChainId,
  ChainName,
  ParsedVaa,
  coalesceChainId,
  parseVaa,
  tryNativeToUint8Array,
} from '@certusone/wormhole-sdk';
import { createSpyRPCServiceClient, subscribeSignedVAA } from '@certusone/wormhole-spydk';

export type VaaContext = {
  raw: Buffer;
  parsed: ParsedVaa;
  chain?: ChainName;
  nativeAddress?: string;
};

export type VaaFilter = {
  chain: ChainName;
  nativeAddress: string;
};

export type SpyRequestOpts = {
  vaaFilters?: VaaFilter[];
};

export type CleanupOpts = {
  seenThresholdMs?: number;
  intervalMs?: number;
  maxToRemove?: number;
};

export class VaaSpy {
  private _spyHost: string;
  private _enableCleanup: boolean;
  private _vaaFilters: VaaFilter[] | null;

  private _seenHashes!: Map<string, Date>;

  constructor(
    opts: { spyHost?: string; enableCleanup?: boolean } & SpyRequestOpts & CleanupOpts = {}
  ) {
    this._spyHost = opts.spyHost ?? 'localhost:7073';
    this._enableCleanup = opts.enableCleanup ?? true;
    if (opts.enableCleanup) {
      this._startCleanupProcedure(opts);
    }

    this._vaaFilters = opts.vaaFilters ?? null;
  }

  async onObservation(callback: (ctx: VaaContext) => void) {
    const client = createSpyRPCServiceClient(this._spyHost);

    // Really wish we could use a filter here... but alas.
    const stream = await subscribeSignedVAA(client, {});

    const vaaFilters = this._vaaFilters;

    const that = this;
    stream.on('data', ({ vaaBytes: raw }) => {
      const ctx: VaaContext = { raw, parsed: parseVaa(raw) };

      if (vaaFilters === null) {
        return that.processUniqueVaa(ctx, callback);
      }

      // Filter out unwanted VAAs.
      for (const { chain, nativeAddress } of vaaFilters) {
        if (
          ctx.parsed.emitterChain == coalesceChainId(chain) &&
          ctx.parsed.emitterAddress.equals(tryNativeToUint8Array(nativeAddress, chain))
        ) {
          return that.processUniqueVaa({ chain, nativeAddress, ...ctx }, callback);
        }
      }
    });
  }

  processUniqueVaa(ctx: VaaContext, callback: (ctx: VaaContext) => void): void {
    if (this._enableCleanup) {
      const hash = ctx.parsed.hash.toString('base64');
      if (this._seenHashes.has(hash)) {
        return;
      }

      this._seenHashes.set(hash, new Date());
    }

    return callback(ctx);
  }

  private _startCleanupProcedure(args: CleanupOpts) {
    let { seenThresholdMs, intervalMs, maxToRemove } = args;
    seenThresholdMs ??= 2_000; // 2 seconds
    intervalMs ??= seenThresholdMs;
    maxToRemove ??= 69_420; // hehe

    this._seenHashes = new Map<string, Date>();
    const seenHashes = this._seenHashes;

    setInterval(() => {
      const now = new Date();
      let numRemoved = 0;
      for (const [hash, seenTime] of seenHashes.entries()) {
        if (numRemoved >= maxToRemove!) {
          break;
        }

        if (now.getTime() - seenTime.getTime() > seenThresholdMs!) {
          seenHashes.delete(hash);
          ++numRemoved;
        }
      }
    }, intervalMs!);
  }
}
