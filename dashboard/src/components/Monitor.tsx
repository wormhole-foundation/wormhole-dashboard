import { ChainId, coalesceChainName } from '@certusone/wormhole-sdk/lib/esm/utils/consts';
import { ArrowDownward, ArrowUpward, Code, Launch, Settings } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  SxProps,
  Theme,
  Tooltip,
  Typography,
} from '@mui/material';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CollapsibleSection from './CollapsibleSection';
import { DataWrapper, getEmptyDataWrapper, receiveDataWrapper } from '../utils/DataWrapper';
import { useSettings } from '../contexts/MonitorSettingsContext';
import {
  explorerBlock,
  explorerTx,
  explorerVaa,
} from '@wormhole-foundation/wormhole-monitor-common';
import { useNetworkContext } from '../contexts/NetworkContext';

type LastBlockByChain = { [chainId: string]: string };
type CountsByChain = {
  [chain in ChainId]?: {
    numTotalMessages: number;
    numMessagesWithoutVaas: number;
    lastRowKey: string;
    firstMissingVaaRowKey: string;
  };
};
type MissesByChain = {
  [chain in ChainId]?: {
    messages: ObservedMessage[];
    lastUpdated: number;
    lastRowKey: string;
  };
};
type ObservedMessage = {
  id: string;
  chain: number;
  block: number;
  emitter: string;
  seq: string;
  timestamp: any;
  txHash: any;
  hasSignedVaa: any;
};

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
// const emptyBlockSx: SxProps<Theme> = {
//   ...baseBlockSx,
//   backgroundColor: '#333',
// };
const FOUND_COLOR = 'green';
const MISSING_COLOR = 'darkred';
const doneBlockSx: SxProps<Theme> = {
  ...baseBlockSx,
  backgroundColor: FOUND_COLOR,
};
const missingBlockSx: SxProps<Theme> = {
  ...baseBlockSx,
  backgroundColor: MISSING_COLOR,
};

function BlockDetail({ chain, message }: { chain: string; message: ObservedMessage }) {
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
            href={explorerTx(Number(chain) as ChainId, message.txHash)}
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
            href={explorerVaa(vaaId)}
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
          href={explorerBlock(Number(chain) as ChainId, message.block.toString())}
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

function DetailBlocks({ chain }: { chain: string }) {
  const { currentNetwork } = useNetworkContext();
  const { showDetails } = useSettings();
  const [messagesWrapper, setMessagesWrapper] = useState<DataWrapper<ObservedMessage[]>>(
    getEmptyDataWrapper()
  );
  const [fromId, setFromId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetchLastBlockByChain = async () => {
      if (cancelled) return;
      setMessagesWrapper((r) => ({ ...r, isFetching: true, error: null }));
      try {
        const response = await axios.get<ObservedMessage[]>(
          `${currentNetwork.endpoint}/messages/${chain}${fromId ? `?fromId=${fromId}` : ''}`
        );
        if (response.data && !cancelled) {
          response.data.reverse();
          setMessagesWrapper((w) => receiveDataWrapper([...response.data, ...(w.data || [])]));
        }
      } catch (e: any) {
        setMessagesWrapper((r) => ({
          ...r,
          isFetching: false,
          error: e?.message || 'An error occurred while fetching the database',
        }));
      }
    };
    (async () => {
      fetchLastBlockByChain();
    })();
    return () => {
      cancelled = true;
    };
  }, [chain, fromId, currentNetwork]);
  let rawMessages = messagesWrapper.data;
  if (rawMessages && rawMessages.length === 0) {
    rawMessages = null;
  }
  const lastMessageId = rawMessages && rawMessages[0].id;
  const handlePageClick = useCallback(() => {
    if (lastMessageId) {
      setFromId(lastMessageId);
    }
  }, [lastMessageId]);
  const messages = useMemo(() => {
    if (!rawMessages || !showDetails) return rawMessages;
    return [...(rawMessages || [])].reverse();
  }, [rawMessages, showDetails]);
  const loadMoreButton = (
    <Button
      onClick={handlePageClick}
      endIcon={showDetails ? <ArrowDownward /> : <ArrowUpward />}
      disabled={messagesWrapper.isFetching}
      sx={{ my: 1 }}
    >
      Load More
    </Button>
  );
  return (
    <Box textAlign="center" maxWidth={showDetails ? undefined : 16 * 20} mx="auto" my={2}>
      {' '}
      {messagesWrapper.isFetching && !messages ? (
        <CircularProgress />
      ) : rawMessages && rawMessages.length && messages ? (
        <>
          {showDetails ? null : loadMoreButton}
          {showDetails ? (
            messages.map((observedMessage) => (
              <Box
                key={observedMessage.id}
                textAlign="left"
                borderLeft={'4px solid'}
                borderColor={observedMessage.hasSignedVaa ? FOUND_COLOR : MISSING_COLOR}
                borderRadius="2px"
                paddingLeft={1}
              >
                <BlockDetail chain={chain} message={observedMessage} />
                <Divider />
              </Box>
            ))
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
              {messages.map((observedMessage) => (
                <Tooltip
                  key={observedMessage.id}
                  arrow
                  enterDelay={500}
                  enterNextDelay={100}
                  TransitionProps={{ mountOnEnter: true, unmountOnExit: true }}
                  title={<BlockDetail chain={chain} message={observedMessage} />}
                >
                  <Box sx={observedMessage.hasSignedVaa ? doneBlockSx : missingBlockSx} />
                </Tooltip>
              ))}
            </Box>
          )}
          {showDetails ? loadMoreButton : null}
        </>
      ) : (
        <Typography>No messages</Typography>
      )}
    </Box>
  );
}

function ReobserveCodeContent({ misses }: { misses: MissesByChain }) {
  const now = new Date();
  now.setHours(now.getHours() - 2);
  const twoHoursAgo = now.toISOString();
  const { showAllMisses } = useSettings();
  return (
    <pre>
      {Object.entries(misses)
        .map(([chain, info]) => {
          const filteredMisses = showAllMisses
            ? info.messages
            : info.messages.filter((message) => message.timestamp < twoHoursAgo);
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
  const handleOpenClick = useCallback(() => {
    setIsOpen(true);
  }, []);
  const handleCloseClick = useCallback(() => {
    setIsOpen(false);
  }, []);
  return misses ? (
    <>
      <IconButton onClick={handleOpenClick}>
        <Code />
      </IconButton>
      <Dialog open={isOpen} onClose={handleCloseClick} maxWidth="xl">
        <DialogContent>
          <ReobserveCodeContent misses={misses} />
        </DialogContent>
      </Dialog>
    </>
  ) : null;
}

function Misses() {
  const { currentNetwork } = useNetworkContext();
  const { showAllMisses } = useSettings();
  const [missesWrapper, setMissesWrapper] = useState<DataWrapper<MissesByChain>>(
    getEmptyDataWrapper()
  );
  const misses = missesWrapper.data;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMissesWrapper((r) => ({ ...r, isFetching: true, error: null }));
      try {
        const response = await axios.get<MissesByChain>(`${currentNetwork.endpoint}/missing-vaas`);
        if (response.data && !cancelled) {
          setMissesWrapper(receiveDataWrapper(response.data));
        }
      } catch (e: any) {
        if (!cancelled) {
          setMissesWrapper((r) => ({
            ...r,
            isFetching: false,
            error: e?.message || 'An error occurred while fetching the database',
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork]);
  const now = new Date();
  now.setHours(now.getHours() - 2);
  const twoHoursAgo = now.toISOString();
  const missesElements = misses
    ? Object.entries(misses)
        .map(([chain, info]) => {
          const filteredMisses = showAllMisses
            ? info.messages
            : info.messages.filter((message) => message.timestamp < twoHoursAgo);
          return filteredMisses.length === 0 ? null : (
            <CollapsibleSection
              key={chain}
              defaultExpanded={false}
              header={`${coalesceChainName(Number(chain) as ChainId)} (${chain}) - ${
                filteredMisses.length
              }`}
            >
              {filteredMisses.map((message) => (
                <Box
                  key={message.id}
                  textAlign="left"
                  borderLeft={'4px solid'}
                  borderColor={message.hasSignedVaa ? FOUND_COLOR : MISSING_COLOR}
                  borderRadius="2px"
                  paddingLeft={1}
                >
                  <BlockDetail chain={chain} message={message} />
                  <Divider />
                </Box>
              ))}
            </CollapsibleSection>
          );
        })
        .filter((el) => !!el)
    : [];
  return (
    <>
      <Box display="flex" alignItems="center">
        <Typography variant="h4">Misses</Typography>
        <Box flexGrow="1" />
        <ReobserveCode misses={misses} />
      </Box>
      <Box pl={0.5}>
        {missesWrapper.receivedAt ? (
          <Typography variant="body2">
            Last retrieved misses at{' '}
            <Box component="span" sx={{ display: 'inline-block' }}>
              {new Date(missesWrapper.receivedAt).toLocaleString()}
            </Box>{' '}
            {missesWrapper.error ? (
              <Typography component="span" color="error" variant="body2">
                {missesWrapper.error}
              </Typography>
            ) : null}
          </Typography>
        ) : (
          <Typography variant="body2">Loading message counts by chain...</Typography>
        )}
      </Box>
      {missesWrapper.isFetching ? (
        <CircularProgress />
      ) : missesElements.length ? (
        missesElements
      ) : (
        <Typography pl={0.5}>No misses{showAllMisses ? '' : ' > 2 Hours'}!</Typography>
      )}
    </>
  );
}

function SettingsButton() {
  const open = useSettings().open;
  return (
    <IconButton onClick={open}>
      <Settings />
    </IconButton>
  );
}

function Monitor() {
  const { currentNetwork } = useNetworkContext();
  const [lastBlockByChainWrapper, setLastBlockByChainWrapper] = useState<
    DataWrapper<LastBlockByChain>
  >(getEmptyDataWrapper());
  const lastBlockByChain = lastBlockByChainWrapper.data;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLastBlockByChainWrapper((r) => ({ ...r, isFetching: true, error: null }));
      try {
        const url: string = `${currentNetwork.endpoint}/latest-blocks`;
        const response = await axios.get<LastBlockByChain>(url);
        if (response.data && !cancelled) {
          setLastBlockByChainWrapper(receiveDataWrapper(response.data));
        }
      } catch (e: any) {
        if (!cancelled) {
          setLastBlockByChainWrapper((r) => ({
            ...r,
            isFetching: false,
            error: e?.message || 'An error occurred while fetching the database',
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork]);
  const [messageCountsWrapper, setMessageCountsWrapper] = useState<DataWrapper<CountsByChain>>(
    getEmptyDataWrapper()
  );
  const messageCounts = messageCountsWrapper.data;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMessageCountsWrapper((r) => ({ ...r, isFetching: true, error: null }));
      try {
        const url: string = `${currentNetwork.endpoint}/message-counts`;
        const response = await axios.get<CountsByChain>(url);
        if (response.data && !cancelled) {
          setMessageCountsWrapper(receiveDataWrapper(response.data));
        }
      } catch (e: any) {
        if (!cancelled) {
          setMessageCountsWrapper((r) => ({
            ...r,
            isFetching: false,
            error: e?.message || 'An error occurred while fetching the database',
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork]);
  return (
    <Card sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', mb: 1, alignItems: 'center' }}>
        <div></div>
        <Box sx={{ flexGrow: 1 }} />
        <SettingsButton />
      </Box>
      <Box mb={2}>
        <Misses />
      </Box>
      <Typography variant="h4">Chains</Typography>
      <Box pl={0.5}>
        {lastBlockByChainWrapper.receivedAt ? (
          <Typography variant="body2">
            Last retrieved latest blocks at{' '}
            <Box component="span" sx={{ display: 'inline-block' }}>
              {new Date(lastBlockByChainWrapper.receivedAt).toLocaleString()}
            </Box>{' '}
            {lastBlockByChainWrapper.error ? (
              <Typography component="span" color="error" variant="body2">
                {lastBlockByChainWrapper.error}
              </Typography>
            ) : null}
          </Typography>
        ) : (
          <Typography variant="body2">Loading last block by chain...</Typography>
        )}
        {messageCountsWrapper.receivedAt ? (
          <Typography variant="body2">
            Last retrieved message counts at{' '}
            <Box component="span" sx={{ display: 'inline-block' }}>
              {new Date(messageCountsWrapper.receivedAt).toLocaleString()}
            </Box>{' '}
            {messageCountsWrapper.error ? (
              <Typography component="span" color="error" variant="body2">
                {messageCountsWrapper.error}
              </Typography>
            ) : null}
          </Typography>
        ) : (
          <Typography variant="body2">Loading message counts by chain...</Typography>
        )}
      </Box>
      {lastBlockByChainWrapper.isFetching ? (
        <CircularProgress />
      ) : (
        lastBlockByChain &&
        Object.entries(lastBlockByChain).map(([chain, lastBlock]) => (
          <CollapsibleSection
            key={chain}
            defaultExpanded={false}
            header={
              <div>
                <Typography variant="h5" sx={{ mb: 0.5 }}>
                  {coalesceChainName(Number(chain) as ChainId)} ({chain})
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  Last Indexed Block - {lastBlock.split('/')[0]}
                  {' - '}
                  {new Date(lastBlock.split('/')[1]).toLocaleString()}
                </Typography>
                {messageCounts?.[Number(chain) as ChainId] ? (
                  <Typography
                    component="div"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Box sx={missingBlockSx} />
                    &nbsp;= {messageCounts?.[Number(chain) as ChainId]?.numMessagesWithoutVaas}
                    &nbsp;&nbsp;
                    <Box sx={doneBlockSx} />
                    &nbsp;={' '}
                    {(messageCounts?.[Number(chain) as ChainId]?.numTotalMessages || 0) -
                      (messageCounts?.[Number(chain) as ChainId]?.numMessagesWithoutVaas || 0)}
                  </Typography>
                ) : null}
              </div>
            }
          >
            <DetailBlocks chain={chain} />
          </CollapsibleSection>
        ))
      )}
    </Card>
  );
}

export default Monitor;
