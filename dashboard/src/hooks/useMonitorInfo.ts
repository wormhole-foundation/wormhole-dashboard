import { ChainId } from '@certusone/wormhole-sdk';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { DataWrapper, getEmptyDataWrapper, receiveDataWrapper } from '../utils/DataWrapper';

export type LastBlockByChain = { [chainId: string]: string };
export type CountsByChain = {
  [chain in ChainId]?: {
    numTotalMessages: number;
    numMessagesWithoutVaas: number;
    lastRowKey: string;
    firstMissingVaaRowKey: string;
  };
};
export type MissesByChain = {
  [chain in ChainId]?: {
    messages: ObservedMessage[];
    lastUpdated: number;
    lastRowKey: string;
  };
};
export type ObservedMessage = {
  id: string;
  chain: number;
  block: number;
  emitter: string;
  seq: string;
  timestamp: any;
  txHash: any;
  hasSignedVaa: any;
};

const POLL_INTERVAL_MS = 60 * 1000;

const useMonitorInfo = () => {
  const { currentNetwork } = useNetworkContext();

  const [lastBlockByChainWrapper, setLastBlockByChainWrapper] = useState<
    DataWrapper<LastBlockByChain>
  >(getEmptyDataWrapper());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLastBlockByChainWrapper((r) => ({ ...r, isFetching: true, error: null }));
      while (!cancelled) {
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
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
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
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMessageCountsWrapper((r) => ({ ...r, isFetching: true, error: null }));
      while (!cancelled) {
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
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork]);

  const [missesWrapper, setMissesWrapper] = useState<DataWrapper<MissesByChain>>(
    getEmptyDataWrapper()
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMissesWrapper((r) => ({ ...r, isFetching: true, error: null }));
      while (!cancelled) {
        try {
          const response = await axios.get<MissesByChain>(
            `${currentNetwork.endpoint}/missing-vaas`
          );
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
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork]);

  return { lastBlockByChainWrapper, messageCountsWrapper, missesWrapper };
};

export default useMonitorInfo;
