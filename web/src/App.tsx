import { ChainId, coalesceChainName } from '@certusone/wormhole-sdk/lib/esm/utils/consts';
import { ArrowDownward, ArrowUpward, Launch, Settings } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
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
import { DataWrapper, getEmptyDataWrapper, receiveDataWrapper } from './DataWrapper';
import { useSettings } from './SettingsContext';
import { explorerBlock, explorerTx, explorerVaa } from './utils';

type LastBlockByChain = { [chainId: string]: string };
type CountsByChain = {
  [chain in ChainId]?: {
    numTotalMessages: number;
    numMessagesWithoutVaas: number;
    lastRowKey: string;
    firstMissingVaaRowKey: string;
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
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }} gutterBottom>
          {message.txHash}{' '}
          <IconButton
            href={explorerTx(Number(chain) as ChainId, message.txHash)}
            target="_blank"
            size="small"
            sx={inlineIconButtonSx}
          >
            <Launch fontSize="inherit" />
          </IconButton>
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', ml: 1 }} gutterBottom>
          {vaaId}{' '}
          <IconButton
            href={explorerVaa(vaaId)}
            target="_blank"
            size="small"
            sx={inlineIconButtonSx}
          >
            <Launch fontSize="inherit" />
          </IconButton>
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
  const { showDetails, hideFound } = useSettings();
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
          `https://europe-west3-wormhole-315720.cloudfunctions.net/messages/${chain}${
            fromId ? `?fromId=${fromId}` : ''
          }`
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
  }, [chain, fromId]);
  const rawMessages = messagesWrapper.data;
  const lastMessageId = rawMessages && rawMessages[0].id;
  const handlePageClick = useCallback(() => {
    if (lastMessageId) {
      setFromId(lastMessageId);
    }
  }, [lastMessageId]);
  const messages = useMemo(() => {
    if (!rawMessages) return rawMessages;
    const messages = hideFound ? rawMessages.filter((m) => !m.hasSignedVaa) : rawMessages;
    if (!showDetails) return messages;
    return [...(messages || [])].reverse();
  }, [rawMessages, showDetails, hideFound]);
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

function SettingsButton() {
  const open = useSettings().open;
  return (
    <IconButton onClick={open}>
      <Settings />
    </IconButton>
  );
}

function App() {
  const [lastBlockByChainWrapper, setLastBlockByChainWrapper] = useState<
    DataWrapper<LastBlockByChain>
  >(getEmptyDataWrapper());
  const lastBlockByChain = lastBlockByChainWrapper.data;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLastBlockByChainWrapper((r) => ({ ...r, isFetching: true, error: null }));
      try {
        const response = await axios.get<LastBlockByChain>(
          'https://europe-west3-wormhole-315720.cloudfunctions.net/latest-blocks'
        );
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
  }, []);
  const [messageCountsWrapper, setMessageCountsWrapper] = useState<DataWrapper<CountsByChain>>(
    getEmptyDataWrapper()
  );
  const messageCounts = messageCountsWrapper.data;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMessageCountsWrapper((r) => ({ ...r, isFetching: true, error: null }));
      try {
        const response = await axios.get<CountsByChain>(
          'https://europe-west3-wormhole-315720.cloudfunctions.net/message-counts'
        );
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
  }, []);
  return (
    <Box sx={{ m: { xs: 1, md: 2 } }}>
      <Box sx={{ display: 'flex', mb: 1, alignItems: 'center' }}>
        <div>
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
              Last retrieved latest blocks at{' '}
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
        </div>
        <Box sx={{ flexGrow: 1 }} />
        <SettingsButton />
      </Box>
      {lastBlockByChain &&
        Object.entries(lastBlockByChain).map(([chain, lastBlock]) => (
          <CollapsibleSection
            key={chain}
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
        ))}
    </Box>
  );
}

export default App;
