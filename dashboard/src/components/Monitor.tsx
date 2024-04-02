import { ArrowDownward, ArrowUpward, Code, ExpandMore, Launch } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import {
  CHAIN_INFO_MAP,
  MISS_THRESHOLD_IN_MINS,
  MISS_THRESHOLD_LABEL,
  explorerBlock,
  explorerTx,
  explorerVaa,
} from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Environment, useCurrentEnvironment, useNetworkContext } from '../contexts/NetworkContext';
import { useSettingsContext } from '../contexts/SettingsContext';
import { CloudGovernorInfo } from '../hooks/useCloudGovernorInfo';
import useMonitorInfo, { MissesByChain, ObservedMessage } from '../hooks/useMonitorInfo';
import { DataWrapper, getEmptyDataWrapper, receiveDataWrapper } from '../utils/DataWrapper';
import CollapsibleSection from './CollapsibleSection';
import { CHAIN_ICON_MAP } from '../utils/consts';
import { ChainId, chainIdToChain } from '@wormhole-foundation/sdk-base';

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

function DetailBlocks({ chain }: { chain: string }) {
  const { currentNetwork } = useNetworkContext();
  const {
    settings: { showMonitorDetails: showDetails },
  } = useSettingsContext();
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
  now.setMinutes(now.getMinutes() - MISS_THRESHOLD_IN_MINS);
  const missThreshold = now.toISOString();
  const {
    settings: { showAllMisses },
  } = useSettingsContext();
  return (
    <pre>
      {Object.entries(misses)
        .map(([chain, info]) => {
          const filteredMisses = showAllMisses
            ? info.messages
            : info.messages.filter((message) => message.timestamp < missThreshold);
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

function Misses({
  governorInfo,
  missesWrapper,
}: {
  governorInfo?: CloudGovernorInfo | null;
  missesWrapper: DataWrapper<MissesByChain>;
}) {
  const {
    settings: { showAllMisses },
  } = useSettingsContext();
  const misses = missesWrapper.data;
  const now = new Date();
  now.setMinutes(now.getMinutes() - MISS_THRESHOLD_IN_MINS);
  const missThreshold = now.toISOString();
  const missesElements = misses
    ? Object.entries(misses)
        .map(([chain, info]) => {
          const filteredMisses = showAllMisses
            ? info.messages
            : info.messages
                .filter((message) => message.timestamp < missThreshold)
                .filter(
                  (message) =>
                    !governorInfo?.enqueuedVAAs.some(
                      (enqueuedVAA) =>
                        enqueuedVAA.emitterChain === message.chain &&
                        enqueuedVAA.emitterAddress === message.emitter &&
                        enqueuedVAA.sequence === message.seq
                    )
                );
          return filteredMisses.length === 0 ? null : (
            <CollapsibleSection
              key={chain}
              defaultExpanded={false}
              header={`${chainIdToChain.get(Number(chain) as ChainId)} (${chain}) - ${
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
    <Accordion defaultExpanded TransitionProps={{ mountOnEnter: true, unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box display="flex" alignItems="center" flexGrow="1">
          <Typography>Misses</Typography>
          <Box flexGrow="1" />
          <ReobserveCode misses={misses} />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
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
        {missesWrapper.isFetching ? (
          <CircularProgress />
        ) : missesElements.length ? (
          missesElements
        ) : (
          <Typography pl={0.5}>
            No misses{showAllMisses ? '' : ` > ${MISS_THRESHOLD_LABEL}`}!
          </Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

function Monitor({ governorInfo }: { governorInfo?: CloudGovernorInfo | null }) {
  const network = useCurrentEnvironment();
  const {
    settings: { showAllMisses },
  } = useSettingsContext();
  const { lastBlockByChainWrapper, messageCountsWrapper, missesWrapper } = useMonitorInfo();
  const lastBlockByChain = lastBlockByChainWrapper.data;
  const messageCounts = messageCountsWrapper.data;
  const misses = missesWrapper.data;
  const missesByChain = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - MISS_THRESHOLD_IN_MINS);
    const missThreshold = now.toISOString();
    return misses
      ? Object.entries(misses).reduce<{ [chainId: number]: number }>((counts, [chain, info]) => {
          const filteredMisses = showAllMisses
            ? info.messages
            : info.messages
                .filter((message) => message.timestamp < missThreshold)
                .filter(
                  (message) =>
                    !governorInfo?.enqueuedVAAs.some(
                      (enqueuedVAA) =>
                        enqueuedVAA.emitterChain === message.chain &&
                        enqueuedVAA.emitterAddress === message.emitter &&
                        enqueuedVAA.sequence === message.seq
                    )
                );
          return filteredMisses.length === 0
            ? counts
            : { ...counts, [Number(chain) as ChainId]: filteredMisses.length };
        }, {})
      : {};
  }, [governorInfo?.enqueuedVAAs, misses, showAllMisses]);
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
          <Box flexGrow={1} />
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            {Object.keys(missesByChain)
              .sort()
              .map((chainId) => (
                <Box key={chainId} display="flex" alignItems="center">
                  <Box
                    ml={2}
                    display="flex"
                    alignItems="center"
                    borderRadius="50%"
                    sx={{ p: 0.5, backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >
                    {CHAIN_ICON_MAP[chainId] ? (
                      <img
                        src={CHAIN_ICON_MAP[chainId]}
                        alt={
                          CHAIN_INFO_MAP[network][chainId]?.name ||
                          chainIdToChain.get(Number(chainId) as ChainId)
                        }
                        width={24}
                        height={24}
                      />
                    ) : (
                      <Typography variant="body2">{chainId}</Typography>
                    )}
                  </Box>
                  <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                    {missesByChain[Number(chainId)]}
                  </Typography>
                </Box>
              ))}
          </Box>
        </Box>
      }
    >
      <Box mt={2}>
        <Card>
          <Misses governorInfo={governorInfo} missesWrapper={missesWrapper} />
        </Card>
      </Box>
      <Box mt={2}>
        <Card>
          <Accordion TransitionProps={{ mountOnEnter: true, unmountOnExit: true }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Chains</Typography>
            </AccordionSummary>
            <AccordionDetails>
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
                          {chainIdToChain.get(Number(chain) as ChainId)} ({chain})
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
                            &nbsp;={' '}
                            {messageCounts?.[Number(chain) as ChainId]?.numMessagesWithoutVaas}
                            &nbsp;&nbsp;
                            <Box sx={doneBlockSx} />
                            &nbsp;={' '}
                            {(messageCounts?.[Number(chain) as ChainId]?.numTotalMessages || 0) -
                              (messageCounts?.[Number(chain) as ChainId]?.numMessagesWithoutVaas ||
                                0)}
                          </Typography>
                        ) : null}
                      </div>
                    }
                  >
                    <DetailBlocks chain={chain} />
                  </CollapsibleSection>
                ))
              )}
            </AccordionDetails>
          </Accordion>
        </Card>
      </Box>
    </CollapsibleSection>
  );
}

export default Monitor;
