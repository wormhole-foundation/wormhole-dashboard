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
import { ChainId, chainIdToChain, isChainId } from '@wormhole-foundation/sdk-base';
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

type Staleness = 'healthy' | 'warning' | 'error' | 'unknown';

function getStaleness(lastBlockTimestampMs: number | null, now: number = Date.now()): Staleness {
  if (lastBlockTimestampMs === null) return 'unknown';
  const age = now - lastBlockTimestampMs;
  if (age >= STALE_BLOCK_ERROR_MS) return 'error';
  if (age >= STALE_BLOCK_WARNING_MS) return 'warning';
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
        return {
          chainId,
          chainLabel:
            chainIdToChain.get(Number(chainId) as ChainId) ?? chainIdToName(Number(chainId)),
          lastBlock,
          lastBlockTimestampMs,
          staleness: getStaleness(lastBlockTimestampMs, nowMs),
          misses: filteredMisses,
        };
      })
      .sort((a, b) => Number(a.chainId) - Number(b.chainId));
  }, [governorInfo?.enqueuedVAAs, lastBlockByChain, misses, showAllMisses, showUnknownChains]);

  const headerChips = useMemo(
    () => summaries.filter((s) => s.misses.length > 0 || s.staleness !== 'healthy'),
    [summaries]
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
      ) : summaries.length === 0 ? (
        <Typography pl={0.5}>
          No chains reporting
          {showAllMisses ? '' : ` · misses filtered to > ${MISS_THRESHOLD_LABEL}`}
        </Typography>
      ) : (
        <Box display="flex" flexWrap="wrap" alignItems="stretch" justifyContent="center">
          {summaries.map((summary) => (
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
