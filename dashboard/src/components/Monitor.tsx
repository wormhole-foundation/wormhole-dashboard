import {
  CheckCircleOutline,
  Code,
  ErrorOutline,
  InfoOutlined,
  Launch,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardActionArea,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Hidden,
  IconButton,
  SxProps,
  Theme,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ChainId,
  chainIdToChain,
  chainToChainId,
  isChainId,
  Chain,
} from '@wormhole-foundation/sdk-base';
import {
  MISS_THRESHOLD_LABEL,
  chainIdToName,
  explorerBlock,
  explorerTx,
  explorerVaa,
  getMissThreshold,
} from '@wormhole-foundation/wormhole-monitor-common';
import { useCallback, useMemo, useState } from 'react';
import TimeAgo from 'react-timeago';
import { Environment, useCurrentEnvironment } from '../contexts/NetworkContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { CloudGovernorInfo } from '../hooks/useCloudGovernorInfo';
import useAptosLatestSequence from '../hooks/useAptosLatestSequence';
import useMonitorInfo, { MissesByChain, ObservedMessage } from '../hooks/useMonitorInfo';
import { CHAIN_ICON_MAP } from '../utils/consts';
import CollapsibleSection from './CollapsibleSection';

const inlineIconButtonSx: SxProps<Theme> = {
  fontSize: '1em',
  padding: 0,
  mt: -0.5,
};
const FOUND_COLOR = 'green';
const MISSING_COLOR = 'darkred';

// Thresholds for "time since the watcher last indexed a block on this chain".
// Some chains finalize slowly (e.g. ~30 min on certain L2s), so the warning
// threshold needs to sit above that normal lag to avoid false positives.
const STALE_BLOCK_WARNING_MS = 45 * 60 * 1000;
const STALE_BLOCK_ERROR_MS = 90 * 60 * 1000;

// Chains with unusually long finality windows (e.g. Linea, Ink) can lag well
// beyond the default thresholds during normal operation, so give them a wider
// window before flagging: warn at 4 hours, error at 8 hours.
const LONG_FINALITY_WARNING_MS = 4 * 60 * 60 * 1000;
const LONG_FINALITY_ERROR_MS = 8 * 60 * 60 * 1000;
const LONG_FINALITY_CHAINS = new Set<Chain>(['Linea', 'Ink']);

// Aptos is event-driven: its stored last-block timestamp only advances when a
// Wormhole message occurs, so time-based staleness alone yields false errors
// during quiet periods. It's reconciled against the on-chain sequence instead.
const APTOS_CHAIN_ID: number = chainToChainId('Aptos');

type Staleness = 'healthy' | 'warning' | 'error' | 'unknown';

function getStaleness(
  lastBlockTimestampMs: number | null,
  chainName?: Chain,
  now: number = Date.now()
): Staleness {
  if (lastBlockTimestampMs === null) return 'unknown';
  const age = now - lastBlockTimestampMs;
  const isLongFinality = chainName ? LONG_FINALITY_CHAINS.has(chainName) : false;
  const errorMs = isLongFinality ? LONG_FINALITY_ERROR_MS : STALE_BLOCK_ERROR_MS;
  const warningMs = isLongFinality ? LONG_FINALITY_WARNING_MS : STALE_BLOCK_WARNING_MS;
  if (age >= errorMs) return 'error';
  if (age >= warningMs) return 'warning';
  return 'healthy';
}

function StalenessIcon({ staleness }: { staleness: Staleness }) {
  if (staleness === 'healthy')
    return <CheckCircleOutline color="success" sx={{ fontSize: '1rem' }} />;
  if (staleness === 'warning')
    return <WarningAmberOutlined color="warning" sx={{ fontSize: '1rem' }} />;
  if (staleness === 'error') return <ErrorOutline color="error" sx={{ fontSize: '1rem' }} />;
  return <InfoOutlined color="disabled" sx={{ fontSize: '1rem' }} />;
}

function MissDetail({ chain, message }: { chain: string; message: ObservedMessage }) {
  const network: Environment = useCurrentEnvironment();
  const vaaId = `${message.chain}/${message.emitter}/${message.seq}`;
  return (
    <Box>
      <Typography sx={{ mt: 2 }} gutterBottom>
        VAA
      </Typography>
      <Box sx={{ mb: 1 }}>
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
          gutterBottom
        >
          <IconButton
            href={explorerTx(network, Number(chain) as ChainId, message.txHash)}
            target="_blank"
            size="small"
            sx={inlineIconButtonSx}
          >
            <Launch fontSize="inherit" />
          </IconButton>{' '}
          {message.txHash}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', ml: 1, wordBreak: 'break-all' }}
          gutterBottom
        >
          <IconButton
            href={explorerVaa(network, vaaId)}
            target="_blank"
            size="small"
            sx={inlineIconButtonSx}
          >
            <Launch fontSize="inherit" />
          </IconButton>{' '}
          {vaaId}
        </Typography>
      </Box>
      <Typography gutterBottom>
        Block {message.block}{' '}
        <IconButton
          href={explorerBlock(network, Number(chain) as ChainId, message.block.toString())}
          target="_blank"
          size="small"
          sx={inlineIconButtonSx}
        >
          <Launch fontSize="inherit" />
        </IconButton>
      </Typography>
      <Typography variant="body2" gutterBottom>
        {new Date(message.timestamp).toLocaleString()}
      </Typography>
    </Box>
  );
}

function ReobserveCodeContent({ misses }: { misses: MissesByChain }) {
  const now = new Date();
  const {
    settings: { showAllMisses },
  } = useSettingsContext();
  return (
    <pre>
      {Object.entries(misses)
        .map(([chain, info]) => {
          const filteredMisses = showAllMisses
            ? info.messages
            : info.messages.filter((message) => message.timestamp < getMissThreshold(now, chain));
          return filteredMisses.length === 0
            ? null
            : filteredMisses
                .map((m) => `send-observation-request ${chain} ${m.txHash.replace('0x', '')}`)
                .join('\n');
        })
        .filter((c) => !!c)
        .join('\n')}
    </pre>
  );
}

function ReobserveCode({ misses }: { misses: MissesByChain | null }) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const handleOpenClick = useCallback((event: any) => {
    event.stopPropagation();
    setIsOpen(true);
  }, []);
  const handleCloseClick = useCallback((event: any) => {
    event.stopPropagation();
    setIsOpen(false);
  }, []);
  return misses ? (
    <>
      <Tooltip title="Show reobserve commands">
        <IconButton onClick={handleOpenClick} size="small" sx={{ ml: 0.5 }}>
          <Code fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={isOpen} onClose={handleCloseClick} maxWidth="xl">
        <DialogContent>
          <ReobserveCodeContent misses={misses} />
        </DialogContent>
      </Dialog>
    </>
  ) : null;
}

type ChainSummary = {
  chainId: string;
  chainLabel: string;
  lastBlock: string | null;
  lastBlockTimestampMs: number | null;
  staleness: Staleness;
  misses: ObservedMessage[];
};

function ChainMonitorCard({ summary }: { summary: ChainSummary }) {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const { chainId, chainLabel, lastBlock, lastBlockTimestampMs, staleness, misses } = summary;
  const missCount = misses.length;
  const hasMisses = missCount > 0;
  return (
    <Box m={1} height="100%" sx={{ width: { sm: 232, xs: 160 } }}>
      <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
        <CardActionArea
          onClick={handleOpen}
          sx={{ display: 'flex', p: 1, height: '100%', alignItems: 'center' }}
        >
          <Hidden smDown>
            <Box
              flexBasis={56}
              height="100%"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {CHAIN_ICON_MAP[chainId] ? (
                <Box
                  display="flex"
                  alignItems="center"
                  borderRadius="50%"
                  sx={{ p: 0.5, backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                  <img src={CHAIN_ICON_MAP[chainId]} alt={chainLabel} width={28} height={28} />
                </Box>
              ) : (
                <Typography variant="body2">{chainId}</Typography>
              )}
            </Box>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          </Hidden>
          <Box flexGrow={1} my={-0.5} minWidth={0}>
            <Typography variant="subtitle2" noWrap>
              {chainLabel}{' '}
              <Typography component="span" variant="caption" color="text.secondary">
                ({chainId})
              </Typography>
            </Typography>
            <Tooltip
              title={
                <Typography variant="body2">
                  {lastBlock ? (
                    <>
                      Last indexed block {lastBlock}
                      {lastBlockTimestampMs
                        ? ` at ${new Date(lastBlockTimestampMs).toLocaleString()}`
                        : null}
                    </>
                  ) : (
                    'No last block reported for this chain.'
                  )}
                </Typography>
              }
            >
              <Box display="flex" alignItems="center" my={0.25}>
                <StalenessIcon staleness={staleness} />
                <Typography variant="caption" sx={{ ml: 0.5 }} noWrap>
                  {lastBlockTimestampMs ? (
                    <TimeAgo date={lastBlockTimestampMs} />
                  ) : (
                    'no recent block'
                  )}
                </Typography>
              </Box>
            </Tooltip>
            <Tooltip
              title={
                <Typography variant="body2">
                  {hasMisses
                    ? `${missCount} miss${missCount === 1 ? '' : 'es'} — click for details`
                    : 'No misses for this chain.'}
                </Typography>
              }
            >
              <Box display="flex" alignItems="center" my={0.25}>
                {hasMisses ? (
                  <ErrorOutline color="error" sx={{ fontSize: '1rem' }} />
                ) : (
                  <CheckCircleOutline color="success" sx={{ fontSize: '1rem' }} />
                )}
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  {missCount} miss{missCount === 1 ? '' : 'es'}
                </Typography>
              </Box>
            </Tooltip>
          </Box>
        </CardActionArea>
      </Card>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {chainLabel} ({chainId})
        </DialogTitle>
        <DialogContent>
          <Box display="flex" alignItems="center" mb={2}>
            <StalenessIcon staleness={staleness} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              Last indexed block {lastBlock ?? 'unknown'}
              {lastBlockTimestampMs ? (
                <>
                  {' — '}
                  {new Date(lastBlockTimestampMs).toLocaleString()} (
                  <TimeAgo date={lastBlockTimestampMs} />)
                </>
              ) : null}
            </Typography>
          </Box>
          <Typography variant="subtitle1" gutterBottom>
            Misses ({missCount})
          </Typography>
          {missCount === 0 ? (
            <Typography variant="body2">None</Typography>
          ) : (
            misses.map((message) => (
              <Box
                key={message.id}
                textAlign="left"
                borderLeft="4px solid"
                borderColor={message.hasSignedVaa ? FOUND_COLOR : MISSING_COLOR}
                borderRadius="2px"
                paddingLeft={1}
              >
                <MissDetail chain={chainId} message={message} />
                <Divider />
              </Box>
            ))
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function Monitor({ governorInfo }: { governorInfo?: CloudGovernorInfo | null }) {
  const {
    settings: { showAllMisses, showUnknownChains },
  } = useSettingsContext();
  const { lastBlockByChainWrapper, missesWrapper } = useMonitorInfo();
  const lastBlockByChain = lastBlockByChainWrapper.data;
  const misses = missesWrapper.data;

  const summaries = useMemo<ChainSummary[]>(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const chainSet = new Set<string>();
    if (lastBlockByChain) Object.keys(lastBlockByChain).forEach((c) => chainSet.add(c));
    if (misses) Object.keys(misses).forEach((c) => chainSet.add(c));
    return Array.from(chainSet)
      .filter((c) => showUnknownChains || isChainId(Number(c)))
      .map<ChainSummary>((chainId) => {
        const raw = lastBlockByChain?.[chainId];
        const [block, ts] = (raw ?? '').split('/');
        const lastBlock = block || null;
        const lastBlockTimestampMs = ts ? new Date(ts).getTime() : null;
        const info = misses?.[Number(chainId) as ChainId];
        const filteredMisses = info
          ? showAllMisses
            ? info.messages
            : info.messages
                .filter((m) => m.timestamp < getMissThreshold(now, chainId))
                .filter(
                  (m) =>
                    !governorInfo?.enqueuedVAAs.some(
                      (e) =>
                        e.emitterChain === m.chain &&
                        e.emitterAddress === m.emitter &&
                        e.sequence === m.seq
                    )
                )
          : [];
        const chainName = chainIdToChain.get(Number(chainId) as ChainId);
        return {
          chainId,
          chainLabel: chainName ?? chainIdToName(Number(chainId)),
          lastBlock,
          lastBlockTimestampMs,
          staleness: getStaleness(lastBlockTimestampMs, chainName, nowMs),
          misses: filteredMisses,
        };
      })
      .sort((a, b) => Number(a.chainId) - Number(b.chainId));
  }, [governorInfo?.enqueuedVAAs, lastBlockByChain, misses, showAllMisses, showUnknownChains]);

  // Aptos only records a block when a Wormhole message occurs, so its stored
  // timestamp can be days old during quiet periods and trip the time-based error
  // even when the watcher is healthy. Only when Aptos looks stale, fetch the
  // latest on-chain event sequence; if the watcher has processed up to it, the
  // watcher is caught up and we treat Aptos as healthy regardless of age.
  const env = useCurrentEnvironment();
  const aptosStaleness = useMemo(
    () => summaries.find((s) => Number(s.chainId) === APTOS_CHAIN_ID)?.staleness,
    [summaries]
  );
  const aptosNeedsCheck = aptosStaleness !== undefined && aptosStaleness !== 'healthy';
  const aptosLatestSequence = useAptosLatestSequence(env, aptosNeedsCheck);
  const adjustedSummaries = useMemo<ChainSummary[]>(() => {
    if (!aptosNeedsCheck || aptosLatestSequence === null) return summaries;
    return summaries.map((s) => {
      if (Number(s.chainId) !== APTOS_CHAIN_ID) return s;
      // Aptos block key is `block_height/timestamp/sequence`.
      const raw = lastBlockByChain?.[s.chainId];
      const watcherSequence = raw ? Number(raw.split('/')[2]) : NaN;
      const caughtUp = !isNaN(watcherSequence) && watcherSequence >= aptosLatestSequence;
      return caughtUp ? { ...s, staleness: 'healthy' } : s;
    });
  }, [summaries, aptosNeedsCheck, aptosLatestSequence, lastBlockByChain]);

  const headerChips = useMemo(
    () => adjustedSummaries.filter((s) => s.misses.length > 0 || s.staleness !== 'healthy'),
    [adjustedSummaries]
  );

  const isInitialLoad =
    (missesWrapper.isFetching && !missesWrapper.receivedAt) ||
    (lastBlockByChainWrapper.isFetching && !lastBlockByChainWrapper.receivedAt);

  return (
    <CollapsibleSection
      defaultExpanded={false}
      header={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            paddingRight: 1,
          }}
        >
          <Box>Monitor</Box>
          {showUnknownChains ? null : (
            <Tooltip
              title={
                <Typography variant="body1">
                  Currently hiding misses for unknown chains. This can be adjusted in the settings.
                </Typography>
              }
              componentsProps={{ tooltip: { sx: { maxWidth: '100%' } } }}
            >
              <Box>
                <InfoOutlined sx={{ fontSize: '.8em', ml: 0.5 }} />
              </Box>
            </Tooltip>
          )}
          <ReobserveCode misses={misses} />
          <Box flexGrow={1} />
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            {headerChips.map((s) => {
              const missCount = s.misses.length;
              const stale = s.staleness !== 'healthy';
              return (
                <Tooltip
                  key={s.chainId}
                  title={
                    <Typography variant="body2">
                      {s.chainLabel} ({s.chainId})
                      {missCount > 0 ? ` — ${missCount} miss${missCount === 1 ? '' : 'es'}` : ''}
                      {stale
                        ? ` — watcher ${s.staleness}${
                            s.lastBlockTimestampMs
                              ? ` (last block ${new Date(s.lastBlockTimestampMs).toLocaleString()})`
                              : ''
                          }`
                        : ''}
                    </Typography>
                  }
                >
                  <Box display="flex" alignItems="center">
                    <Box
                      ml={2}
                      display="flex"
                      alignItems="center"
                      borderRadius="50%"
                      sx={{ p: 0.5, backgroundColor: 'rgba(0,0,0,0.5)' }}
                    >
                      {CHAIN_ICON_MAP[s.chainId] ? (
                        <img
                          src={CHAIN_ICON_MAP[s.chainId]}
                          alt={s.chainLabel}
                          width={24}
                          height={24}
                        />
                      ) : (
                        <Typography variant="body2">{s.chainId}</Typography>
                      )}
                    </Box>
                    {missCount > 0 ? (
                      <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                        {missCount}
                      </Typography>
                    ) : null}
                    {stale ? (
                      <Box sx={{ ml: 0.5, display: 'flex', alignItems: 'center' }}>
                        <StalenessIcon staleness={s.staleness} />
                      </Box>
                    ) : null}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      }
    >
      {isInitialLoad ? (
        <CircularProgress />
      ) : adjustedSummaries.length === 0 ? (
        <Typography pl={0.5}>
          No chains reporting
          {showAllMisses ? '' : ` · misses filtered to > ${MISS_THRESHOLD_LABEL}`}
        </Typography>
      ) : (
        <Box display="flex" flexWrap="wrap" alignItems="stretch" justifyContent="center">
          {adjustedSummaries.map((summary) => (
            <ChainMonitorCard key={summary.chainId} summary={summary} />
          ))}
        </Box>
      )}
      {missesWrapper.receivedAt || lastBlockByChainWrapper.receivedAt ? (
        <Typography variant="body2" sx={{ mt: 2, textAlign: 'right' }}>
          Misses fetched{' '}
          {missesWrapper.receivedAt ? new Date(missesWrapper.receivedAt).toLocaleString() : '—'};
          blocks fetched{' '}
          {lastBlockByChainWrapper.receivedAt
            ? new Date(lastBlockByChainWrapper.receivedAt).toLocaleString()
            : '—'}
          .
          {missesWrapper.error ? (
            <Typography component="span" color="error" variant="body2">
              {' '}
              {missesWrapper.error}
            </Typography>
          ) : null}
          {lastBlockByChainWrapper.error ? (
            <Typography component="span" color="error" variant="body2">
              {' '}
              {lastBlockByChainWrapper.error}
            </Typography>
          ) : null}
        </Typography>
      ) : null}
    </CollapsibleSection>
  );
}

export default Monitor;
