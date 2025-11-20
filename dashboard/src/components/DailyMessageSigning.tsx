import {
  CheckCircleOutline,
  ErrorOutline,
  InfoOutlined,
  Launch,
  RemoveCircleOutline,
} from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { DataWrapper, getEmptyDataWrapper, receiveDataWrapper } from '../utils/DataWrapper';
import CollapsibleSection from './CollapsibleSection';

interface DailyMessageTransaction {
  id: number;
  chain: string;
  status: 'success' | 'skipped' | 'failure';
  transactionHash: string;
  createdAt: string;
  updatedAt: string;
}

interface DailyMessageStatusResponse {
  Testnet: DailyMessageTransaction[];
  Mainnet: DailyMessageTransaction[];
}

// Get Wormhole Scan URL for transaction
const getExplorerUrl = (chain: string, txHash: string): string | null => {
  if (txHash.startsWith('SKIPPED-') || txHash.startsWith('FAILURE-')) {
    return null;
  }

  // Use Wormhole Scan for all transactions
  return `https://wormholescan.io/#/tx/${txHash}`;
};

function TransactionCard({ tx }: { tx: DailyMessageTransaction }) {
  const explorerUrl = getExplorerUrl(tx.chain, tx.transactionHash);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'success':
        return {
          borderColor: 'success.main',
          backgroundColor: 'rgba(0,150,0,0.1)',
          icon: <CheckCircleOutline color="success" fontSize="small" />,
        };
      case 'failure':
        return {
          borderColor: 'error.main',
          backgroundColor: 'rgba(200,0,0,0.1)',
          icon: <ErrorOutline color="error" fontSize="small" />,
        };
      case 'skipped':
      default:
        return {
          borderColor: 'warning.main',
          backgroundColor: 'rgba(200,150,0,0.1)',
          icon: <RemoveCircleOutline color="warning" fontSize="small" />,
        };
    }
  };

  const statusConfig = getStatusConfig(tx.status);

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: { xs: '80px', sm: '100px' },
        minHeight: { xs: '80px', sm: '100px' },
        p: 1,
        m: 0.5,
        borderRadius: 2,
        border: 2,
        borderColor: statusConfig.borderColor,
        backgroundColor: statusConfig.backgroundColor,
        cursor: explorerUrl ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': explorerUrl
          ? {
              transform: 'scale(1.05)',
              boxShadow: 3,
            }
          : {},
      }}
      onClick={() => {
        if (explorerUrl) {
          window.open(explorerUrl, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
        }}
      >
        {statusConfig.icon}
      </Box>
      {explorerUrl && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 4,
            right: 4,
          }}
        >
          <Launch fontSize="small" sx={{ opacity: 0.6 }} />
        </Box>
      )}
      <Typography
        variant="body2"
        fontWeight="bold"
        textAlign="center"
        sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
      >
        {tx.chain}
      </Typography>
      <Typography
        variant="caption"
        textAlign="center"
        sx={{
          fontSize: { xs: '0.65rem', sm: '0.75rem' },
          color: 'text.secondary',
          mt: 0.5,
        }}
      >
        {new Date(tx.updatedAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        })}{' '}
        UTC
      </Typography>
    </Box>
  );
}

function DailyMessageSigning() {
  const [statusWrapper, setStatusWrapper] = useState<DataWrapper<DailyMessageStatusResponse>>(
    getEmptyDataWrapper()
  );

  useEffect(() => {
    let cancelled = false;
    setStatusWrapper((w) => ({ ...w, isFetching: true, error: null }));

    axios
      .get<DailyMessageStatusResponse>('https://api.corinth.gfx.town/api/v1/msc/status')
      .then((response) => {
        if (!cancelled) {
          setStatusWrapper(receiveDataWrapper(response.data));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatusWrapper((w) => ({
            ...w,
            isFetching: false,
            error: error?.message || 'Failed to fetch daily message status',
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const networkData = useMemo(() => {
    if (!statusWrapper.data) return [];
    // Always show Mainnet data, but filter out chains we're not testing
    const excludedChains = ['Solana', 'Bsc', 'Base', 'Arbitrum', 'Ethereum'];
    return statusWrapper.data.Mainnet.filter(
      (tx) => !excludedChains.includes(tx.chain)
    );
  }, [statusWrapper.data]);

  const { successCount, skippedCount, failureCount } = useMemo(() => {
    const successCount = networkData.filter((tx) => tx.status === 'success').length;
    const skippedCount = networkData.filter((tx) => tx.status === 'skipped').length;
    const failureCount = networkData.filter((tx) => tx.status === 'failure').length;
    return { successCount, skippedCount, failureCount };
  }, [networkData]);

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
          <Box>Daily Message Signing</Box>
          <Tooltip
            title={
              <>
                <Typography variant="body1">
                  This section shows the status of automated daily message signing transactions
                  across all supported chains.
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleOutline color="success" />
                    </ListItemIcon>
                    <ListItemText primary="Successfully signed and submitted transactions" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <RemoveCircleOutline color="warning" />
                    </ListItemIcon>
                    <ListItemText primary="Skipped transactions (need more gas)" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <ErrorOutline color="error" />
                    </ListItemIcon>
                    <ListItemText primary="Failed transactions (errors during submission)" />
                  </ListItem>
                </List>
              </>
            }
            componentsProps={{ tooltip: { sx: { maxWidth: '100%' } } }}
          >
            <Box>
              <InfoOutlined sx={{ fontSize: '.8em', ml: 0.5 }} />
            </Box>
          </Tooltip>
          <Box flexGrow={1} />
          {successCount > 0 && (
            <>
              <CheckCircleOutline color="success" sx={{ ml: 2 }} />
              <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                {successCount}
              </Typography>
            </>
          )}
          {skippedCount > 0 && (
            <>
              <RemoveCircleOutline color="warning" sx={{ ml: 2 }} />
              <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                {skippedCount}
              </Typography>
            </>
          )}
          {failureCount > 0 && (
            <>
              <ErrorOutline color="error" sx={{ ml: 2 }} />
              <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
                {failureCount}
              </Typography>
            </>
          )}
        </Box>
      }
    >
      <Box p={2}>
        {statusWrapper.isFetching && (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        )}
        {statusWrapper.error && (
          <Box display="flex" alignItems="center" gap={1} color="error.main" p={2}>
            <ErrorOutline />
            <Typography>{statusWrapper.error}</Typography>
          </Box>
        )}
        {!statusWrapper.isFetching && !statusWrapper.error && networkData.length === 0 && (
          <Typography color="text.secondary" p={2}>
            No daily message signing data available.
          </Typography>
        )}
        {!statusWrapper.isFetching && !statusWrapper.error && networkData.length > 0 && (
          <Box display="flex" flexWrap="wrap" justifyContent="center">
            {networkData.map((tx) => (
              <TransactionCard key={tx.id} tx={tx} />
            ))}
          </Box>
        )}
      </Box>
    </CollapsibleSection>
  );
}

export default DailyMessageSigning;
