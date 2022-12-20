import { ChainId, coalesceChainName } from '@certusone/wormhole-sdk/lib/esm/utils/consts';
import { CheckBox, CheckBoxOutlineBlank, Launch } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  SxProps,
  Theme,
  Tooltip,
  Typography,
} from '@mui/material';
import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CollapsibleSection from './CollapsibleSection';
import { explorerBlock, explorerTx, explorerVaa } from './utils';

type VaasByBlock = { [block: number]: string[] };
type DB = { [chain in ChainId]?: VaasByBlock };

const TIMEOUT = 60 * 1000;
const inlineIconButtonSx: SxProps<Theme> = {
  fontSize: '1em',
  padding: 0,
  mt: -0.5,
};
const baseBlockSx: SxProps<Theme> = {
  height: 16,
  width: 16,
  border: '1px solid black',
  fontSize: '10px',
  textAlign: 'center',
  verticalAlign: 'middle',
};
const emptyBlockSx: SxProps<Theme> = {
  ...baseBlockSx,
  backgroundColor: '#333',
};
const doneBlockSx: SxProps<Theme> = {
  ...baseBlockSx,
  backgroundColor: 'green',
};

async function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

function BlockDetail({ chain, block, vaas }: { chain: string; block: string; vaas: string[] }) {
  const [blockNumber, timestamp] = block.split('/');
  return (
    <Box>
      <Typography gutterBottom>
        Block {blockNumber}{' '}
        <IconButton
          href={explorerBlock(Number(chain) as ChainId, blockNumber)}
          target="_blank"
          size="small"
          sx={inlineIconButtonSx}
        >
          <Launch fontSize="inherit" />
        </IconButton>
      </Typography>
      <Typography variant="body2" gutterBottom>
        {new Date(timestamp).toLocaleString()}
      </Typography>
      <Typography sx={{ mt: 2 }} gutterBottom>
        VAAs
      </Typography>
      {vaas.length === 0
        ? 'None'
        : vaas.map((vaa) => (
            <Box key={vaa} sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }} gutterBottom>
                {vaa.split(':')[0]}{' '}
                <IconButton
                  href={explorerTx(Number(chain) as ChainId, vaa.split(':')[0])}
                  target="_blank"
                  size="small"
                  sx={inlineIconButtonSx}
                >
                  <Launch fontSize="inherit" />
                </IconButton>
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', ml: 1 }} gutterBottom>
                {vaa.split(':')[1]}{' '}
                <IconButton
                  href={explorerVaa(vaa.split(':')[1])}
                  target="_blank"
                  size="small"
                  sx={inlineIconButtonSx}
                >
                  <Launch fontSize="inherit" />
                </IconButton>
              </Typography>
            </Box>
          ))}
    </Box>
  );
}

function DetailBlocks({
  chain,
  vaasByBlock,
  showEmptyBlocks,
  showCounts,
}: {
  chain: string;
  vaasByBlock: VaasByBlock;
  showEmptyBlocks: boolean;
  showCounts: boolean;
}) {
  let filteredEntries = Object.entries(vaasByBlock);
  if (!showEmptyBlocks) {
    filteredEntries = filteredEntries.filter(([block, vaas]) => showEmptyBlocks || vaas.length > 0);
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 2 }}>
      {filteredEntries
        // TODO: this is a hack to not grind the render to a halt
        .slice(Math.max(filteredEntries.length, 100) - 100)
        .map(([block, vaas]) => (
          <Tooltip
            key={block}
            arrow
            enterDelay={500}
            enterNextDelay={100}
            TransitionProps={{ mountOnEnter: true, unmountOnExit: true }}
            title={<BlockDetail chain={chain} block={block} vaas={vaas} />}
          >
            <Box key={block} sx={vaas.length ? doneBlockSx : emptyBlockSx}>
              {showCounts ? vaas.length : null}
            </Box>
          </Tooltip>
        ))}
    </Box>
  );
}

function CircularProgressCountdown({
  autoRefresh,
  nextFetch,
  isFetching,
}: {
  autoRefresh: boolean;
  nextFetch: number;
  isFetching: boolean;
}) {
  const [nextFetchPercent, setNextFetchPercent] = useState<number>(0);
  // clear the state on toggle and refresh
  useEffect(() => {
    setNextFetchPercent(0);
  }, [autoRefresh, isFetching]);
  useEffect(() => {
    if (autoRefresh) {
      let cancelled = false;
      const interval = setInterval(() => {
        const now = Date.now();
        if (nextFetch > now && !cancelled) {
          setNextFetchPercent((1 - (nextFetch - now) / TIMEOUT) * 100);
        }
      }, TIMEOUT / 20);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
  }, [autoRefresh, nextFetch]);
  return (
    <CircularProgress
      size={20}
      variant={isFetching ? 'indeterminate' : 'determinate'}
      value={isFetching ? undefined : nextFetchPercent}
      sx={{ ml: 1 }}
    />
  );
}

function ToggleButton({
  value,
  onClick,
  children,
}: {
  value: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outlined"
      onClick={onClick}
      startIcon={value ? <CheckBox /> : <CheckBoxOutlineBlank />}
      sx={{ mr: 1, mb: 1 }}
    >
      {children}
    </Button>
  );
}

function App() {
  const [dbWrapper, setDbWrapper] = useState<{
    lastFetched: string;
    nextFetch: number;
    isFetching: boolean;
    error: string;
    db: DB;
  }>({
    lastFetched: '',
    isFetching: true,
    nextFetch: Date.now(),
    error: '',
    db: {},
  });
  const db = dbWrapper.db;
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const handleToggleAutoRefresh = useCallback(() => {
    setAutoRefresh((v) => !v);
  }, []);
  const [showEmptyBlocks, setShowEmptyBlocks] = useState<boolean>(false);
  const handleToggleEmptyBlocks = useCallback(() => {
    setShowEmptyBlocks((v) => !v);
  }, []);
  const [showCounts, setShowCounts] = useState<boolean>(false);
  const handleToggleCounts = useCallback(() => {
    setShowCounts((v) => !v);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const fetchDb = async () => {
      if (cancelled) return;
      setDbWrapper((r) => ({ ...r, isFetching: true, error: '' }));
      try {
        const response = await axios.get<DB>('/api/db');
        if (response.data && !cancelled) {
          setDbWrapper({
            lastFetched: new Date().toLocaleString(),
            nextFetch: Date.now() + TIMEOUT,
            isFetching: false,
            error: '',
            db: response.data,
          });
        }
      } catch (e: any) {
        setDbWrapper((r) => ({
          ...r,
          nextFetch: Date.now() + TIMEOUT,
          isFetching: false,
          error: e?.message || 'An error occurred while fetching the database',
        }));
      }
    };
    (async () => {
      fetchDb();
      if (autoRefresh) {
        while (!cancelled) {
          await sleep(TIMEOUT);
          fetchDb();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoRefresh]);
  const metaByChain = useMemo(() => {
    const metaByChain: {
      [chain: string]: {
        lastIndexedBlockNumber: string;
        lastIndexedBlockTime: string;
        counts: {
          empty: number;
          pending: number;
          missed: number;
          done: number;
        };
      };
    } = {};
    Object.entries(db).forEach(([chain, vaasByBlock]) => {
      const entries = Object.entries(vaasByBlock);
      const [lastIndexedBlockNumber, lastIndexedBlockTime] =
        entries[entries.length - 1][0].split('/');
      metaByChain[chain] = {
        lastIndexedBlockNumber,
        lastIndexedBlockTime,
        counts: { empty: 0, pending: 0, missed: 0, done: 0 },
      };
      entries.forEach(([block, vaas]) => {
        if (vaas.length === 0) {
          metaByChain[chain].counts.empty++;
        } else {
          metaByChain[chain].counts.done++;
        }
      });
    });
    return metaByChain;
  }, [db]);
  return (
    <Box sx={{ m: { xs: 1, md: 2 } }}>
      <ToggleButton value={autoRefresh} onClick={handleToggleAutoRefresh}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          Auto-Refresh ({TIMEOUT / 1000}s)
          <CircularProgressCountdown
            autoRefresh={autoRefresh}
            nextFetch={dbWrapper.nextFetch}
            isFetching={dbWrapper.isFetching}
          />
        </Box>
      </ToggleButton>
      <ToggleButton value={showEmptyBlocks} onClick={handleToggleEmptyBlocks}>
        Show Empty Blocks
      </ToggleButton>
      <ToggleButton value={showCounts} onClick={handleToggleCounts}>
        Show Counts
      </ToggleButton>
      {dbWrapper.lastFetched ? (
        <Typography variant="body2">
          Last retrieved at {dbWrapper.lastFetched}{' '}
          {dbWrapper.error ? (
            <Typography component="span" color="error" variant="body2">
              {dbWrapper.error}
            </Typography>
          ) : null}
        </Typography>
      ) : (
        <Typography variant="body2">Loading db...</Typography>
      )}
      {Object.entries(db).map(([chain, vaasByBlock]) => (
        <CollapsibleSection
          key={chain}
          header={
            <div>
              <Typography variant="h5" gutterBottom>
                {coalesceChainName(Number(chain) as ChainId)} ({chain})
              </Typography>
              <Typography
                component="div"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                }}
                gutterBottom
              >
                <Box sx={emptyBlockSx} />
                &nbsp;= {metaByChain[chain].counts.empty}
                &nbsp;&nbsp;
                <Box sx={doneBlockSx} />
                &nbsp;= {metaByChain[chain].counts.done}
              </Typography>
              <Typography variant="body2">
                Last Indexed Block - {metaByChain[chain].lastIndexedBlockNumber}
                {' - '}
                {new Date(metaByChain[chain].lastIndexedBlockTime).toLocaleString()}
              </Typography>
            </div>
          }
        >
          <DetailBlocks
            chain={chain}
            vaasByBlock={vaasByBlock}
            showEmptyBlocks={showEmptyBlocks}
            showCounts={showCounts}
          />
        </CollapsibleSection>
      ))}
    </Box>
  );
}

export default App;
