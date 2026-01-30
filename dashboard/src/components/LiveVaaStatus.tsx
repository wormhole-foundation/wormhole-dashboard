import {
  ArrowDownward,
  ArrowUpward,
  CheckCircleOutline,
  ErrorOutline,
  ExpandLess,
  ExpandMore,
  InfoOutlined,
  Launch,
  Refresh,
  UnfoldLess,
  UnfoldMore,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  SelectChangeEvent,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { chainIdToChain, chainIds, ChainId } from '@wormhole-foundation/sdk-base';
import { isChainDeprecated } from '@wormhole-foundation/wormhole-monitor-common';
import { chainToIcon } from '@wormhole-foundation/sdk-icons';
import axios from 'axios';
import { memo, useEffect, useMemo, useState } from 'react';
import { Redirect, useLocation, useHistory } from 'react-router-dom';
import { useNetworkContext } from '../contexts/NetworkContext';
import { DataWrapper, getEmptyDataWrapper, receiveDataWrapper } from '../utils/DataWrapper';
import CollapsibleSection from './CollapsibleSection';

// Constants
const API_BASE_URL = 'https://api.corinth.gfx.town/api/v1/msc/guardian-stats';
const HEALTH_THRESHOLDS = { healthy: 76, warning: 51 } as const;
const PROBLEM_GUARDIAN_CHAIN_THRESHOLD = 3; // Guardian is "problematic" if underperforming on this many chains
const SVM_CHAIN_IDS: readonly number[] = [1, 51]; // Solana, Fogo

// Types
type SortField = 'guardianName' | 'percentage' | 'lastSignedAt';
type ChainSortField = 'chainName' | 'percentage';
type SortDirection = 'asc' | 'desc';
type HealthStatus = 'healthy' | 'warning' | 'error';
type TimeFrame = 'recent' | 'daily';
type ShimFilter = 'all' | 'shim' | 'native';

function isSvmChain(chainId: number): boolean {
  return SVM_CHAIN_IDS.includes(chainId);
}

function getApiUrl(chainId: number, timeFrame: TimeFrame, shimFilter?: ShimFilter): string {
  const baseUrl = `${API_BASE_URL}/${timeFrame}/${chainId}`;
  const hasShimFilter = (shimFilter === 'shim' || shimFilter === 'native') && isSvmChain(chainId);
  if (hasShimFilter) {
    return `${baseUrl}?isShim=${shimFilter === 'shim'}`;
  }
  return baseUrl;
}

// Helper functions
function getHealthStatus(percentage: number): HealthStatus {
  if (percentage >= HEALTH_THRESHOLDS.healthy) return 'healthy';
  if (percentage >= HEALTH_THRESHOLDS.warning) return 'warning';
  return 'error';
}

function getHealthColor(status: HealthStatus): 'success' | 'warning' | 'error' {
  return status === 'healthy' ? 'success' : status;
}

// Priority for sorting: error first (0), then warning (1), then healthy (2)
function getHealthPriority(percentage: number): number {
  const status = getHealthStatus(percentage);
  return status === 'error' ? 0 : status === 'warning' ? 1 : 2;
}

function countByHealth<T>(items: T[], getPercentage: (item: T) => number) {
  return items.reduce(
    (acc, item) => {
      const status = getHealthStatus(getPercentage(item));
      acc[status]++;
      return acc;
    },
    { healthy: 0, warning: 0, error: 0 }
  );
}

// Shared styles
const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  py: 1,
  px: 2,
  borderBottom: '1px solid',
  borderColor: 'divider',
  '&:last-child': { borderBottom: 'none' },
};

const TABLE_CONTAINER_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  overflow: 'hidden',
};

const TABLE_HEADER_SX = {
  display: 'flex',
  alignItems: 'center',
  py: 1,
  px: 2,
  backgroundColor: 'action.hover',
  borderBottom: '1px solid',
  borderColor: 'divider',
};

interface GuardianStat {
  guardianAddress: string;
  guardianName: string;
  observationCount: number;
  percentage: number;
  lastSignedTx: string;
  lastSignedAt: string;
}

interface GuardianStatsResponse {
  chainId: number;
  chainName: string;
  vaaCount: number;
  endTime: string;
  guardianStats: GuardianStat[];
}

// Dynamically derive supported chains from the SDK, filtering out deprecated chains and testnet chains
const SUPPORTED_CHAIN_IDS: ChainId[] = chainIds
  .filter((id) => id < 10000) // Mainnet chains only (testnet IDs are >= 10000)
  .filter((id) => !isChainDeprecated(id)) as ChainId[];

function getChainIcon(chainId: number): string | null {
  try {
    const chain = chainIdToChain(chainId as ChainId);
    return chainToIcon(chain);
  } catch {
    return null;
  }
}

// Shared Components
function StatusIcon({ status }: { status: HealthStatus }) {
  const color = getHealthColor(status);
  switch (status) {
    case 'healthy':
      return <CheckCircleOutline color={color} fontSize="small" />;
    case 'warning':
      return <WarningAmberOutlined color={color} fontSize="small" />;
    case 'error':
      return <ErrorOutline color={color} fontSize="small" />;
  }
}

function HealthSummary({
  counts,
}: {
  counts: { healthy: number; warning: number; error: number };
}) {
  return (
    <>
      {counts.healthy > 0 && (
        <>
          <CheckCircleOutline color="success" sx={{ ml: 2 }} />
          <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
            {counts.healthy}
          </Typography>
        </>
      )}
      {counts.warning > 0 && (
        <>
          <WarningAmberOutlined color="warning" sx={{ ml: 2 }} />
          <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
            {counts.warning}
          </Typography>
        </>
      )}
      {counts.error > 0 && (
        <>
          <ErrorOutline color="error" sx={{ ml: 2 }} />
          <Typography variant="h6" component="strong" sx={{ ml: 0.5 }}>
            {counts.error}
          </Typography>
        </>
      )}
    </>
  );
}

function LoadingErrorState({ isLoading, error }: { isLoading: boolean; error: string | null }) {
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Box display="flex" alignItems="center" gap={1} color="error.main" p={2}>
        <ErrorOutline />
        <Typography>{error}</Typography>
      </Box>
    );
  }
  return null;
}

function GuardianRow({ guardian, vaaCount }: { guardian: GuardianStat; vaaCount: number }) {
  const status = getHealthStatus(guardian.percentage);
  const color = getHealthColor(status);

  return (
    <Box sx={ROW_SX}>
      <Box sx={{ minWidth: 180, display: 'flex', alignItems: 'center', gap: 1 }}>
        <StatusIcon status={status} />
        <Typography variant="body2" fontWeight="medium">
          {guardian.guardianName}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, mx: 2 }}>
        <LinearProgress
          variant="determinate"
          value={guardian.percentage}
          color={color}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>
      <Box sx={{ minWidth: 100, textAlign: 'right' }}>
        <Typography variant="body2" color={`${color}.main`}>
          {guardian.observationCount}/{vaaCount} ({guardian.percentage}%)
        </Typography>
      </Box>
      <Box
        sx={{
          minWidth: 150,
          textAlign: 'right',
          ml: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 0.5,
        }}
      >
        <Tooltip title={new Date(guardian.lastSignedAt).toISOString()}>
          <Typography variant="caption" color="text.secondary">
            {new Date(guardian.lastSignedAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'UTC',
            })}{' '}
            UTC
          </Typography>
        </Tooltip>
        <Tooltip title="View on Wormhole Scan">
          <IconButton
            size="small"
            href={`https://wormholescan.io/#/tx/${guardian.lastSignedTx}`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ p: 0.25 }}
          >
            <Launch fontSize="small" sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

function SortableHeader<T extends string>({
  label,
  field,
  currentField,
  direction,
  onSort,
  sx,
}: {
  label: string;
  field: T;
  currentField: T;
  direction: SortDirection;
  onSort: (field: T) => void;
  sx?: object;
}) {
  const isActive = currentField === field;
  return (
    <Box
      onClick={() => onSort(field)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': { opacity: 0.8 },
        ...sx,
      }}
    >
      <Typography variant="subtitle2">{label}</Typography>
      {isActive &&
        (direction === 'asc' ? (
          <ArrowUpward sx={{ fontSize: 16, ml: 0.5 }} />
        ) : (
          <ArrowDownward sx={{ fontSize: 16, ml: 0.5 }} />
        ))}
    </Box>
  );
}

// Known guardian names (sorted alphabetically)
const GUARDIAN_NAMES = [
  '01node',
  'ChainLayer',
  'ChainodeTech',
  'Chorus One',
  'Everstake',
  'Figment',
  'Forbole',
  'HashKey Cloud',
  'Inotel',
  'MCF',
  'Moonlet',
  'P2P Validator',
  'RockawayX',
  'Staked',
  'Staking Facilities',
  'Staking Fund',
  'syncnode',
  'Triton',
  'xLabs',
];

type ViewMode = 'aggregate' | 'byChain' | 'byGuardian';

interface ChainGuardianStat {
  chainId: number;
  chainName: string;
  percentage: number;
  observationCount: number;
  vaaCount: number;
  lastSignedTx: string;
  lastSignedAt: string;
}

function ChainRow({ stat }: { stat: ChainGuardianStat }) {
  const status = getHealthStatus(stat.percentage);
  const color = getHealthColor(status);
  const chainIcon = getChainIcon(stat.chainId);

  return (
    <Box sx={ROW_SX}>
      <Box sx={{ minWidth: 180, display: 'flex', alignItems: 'center', gap: 1 }}>
        <StatusIcon status={status} />
        {chainIcon && <img src={chainIcon} alt={stat.chainName} width={20} height={20} />}
        <Typography variant="body2" fontWeight="medium">
          {stat.chainName}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, mx: 2 }}>
        <LinearProgress
          variant="determinate"
          value={stat.percentage}
          color={color}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>
      <Box sx={{ minWidth: 120, textAlign: 'right' }}>
        <Typography variant="body2" color={`${color}.main`}>
          {stat.observationCount}/{stat.vaaCount} ({stat.percentage}%)
        </Typography>
      </Box>
      <Box
        sx={{
          minWidth: 150,
          textAlign: 'right',
          ml: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 0.5,
        }}
      >
        <Tooltip title={new Date(stat.lastSignedAt).toISOString()}>
          <Typography variant="caption" color="text.secondary">
            {new Date(stat.lastSignedAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'UTC',
            })}{' '}
            UTC
          </Typography>
        </Tooltip>
        <Tooltip title="View on Wormhole Scan">
          <IconButton
            size="small"
            href={`https://wormholescan.io/#/tx/${stat.lastSignedTx}`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ p: 0.25 }}
          >
            <Launch fontSize="small" sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

// Aggregate view types and components
interface AggregateChainData {
  chainId: number;
  chainName: string;
  vaaCount: number;
  guardianStats: GuardianStat[];
}

function GuardianPill({
  guardian,
  vaaCount,
  onClick,
}: {
  guardian: GuardianStat;
  vaaCount: number;
  onClick?: (guardianName: string) => void;
}) {
  const status = getHealthStatus(guardian.percentage);
  const bgColor =
    status === 'healthy' ? 'success.main' : status === 'warning' ? 'warning.main' : 'error.main';

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="body2">
            {guardian.observationCount}/{vaaCount} observations
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Last signed: {new Date(guardian.lastSignedAt).toLocaleString()}
          </Typography>
          {onClick && (
            <Typography variant="caption" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
              Click to view guardian details
            </Typography>
          )}
        </Box>
      }
    >
      <Box
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={() => onClick?.(guardian.guardianName)}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick(guardian.guardianName);
          }
        }}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          px: 1.5,
          py: 0.75,
          borderRadius: 1,
          bgcolor: bgColor,
          color: 'common.black',
          fontSize: '0.85rem',
          fontWeight: 600,
          mr: 0.5,
          mb: 0.5,
          cursor: onClick ? 'pointer' : 'default',
          minWidth: 140,
          transition: 'transform 0.1s, box-shadow 0.1s',
          '&:hover': onClick
            ? {
                transform: 'translateY(-1px)',
                boxShadow: 2,
              }
            : {},
        }}
      >
        <span>{guardian.guardianName}</span>
        <Box component="span" sx={{ fontWeight: 700 }}>
          {guardian.percentage}%
        </Box>
      </Box>
    </Tooltip>
  );
}

const AggregateRow = memo(function AggregateRow({
  data,
  isExpanded,
  onToggle,
  onChainClick,
  onGuardianClick,
}: {
  data: AggregateChainData;
  isExpanded: boolean;
  onToggle: (chainId: number) => void;
  onChainClick?: (chainId: number) => void;
  onGuardianClick?: (guardianName: string) => void;
}) {
  const chainIcon = getChainIcon(data.chainId);

  // Memoize expensive calculations
  const sortedGuardians = useMemo(() => {
    return [...data.guardianStats].sort((a, b) => {
      const priorityDiff = getHealthPriority(a.percentage) - getHealthPriority(b.percentage);
      if (priorityDiff !== 0) return priorityDiff;
      return a.percentage - b.percentage;
    });
  }, [data.guardianStats]);

  const { avgPercentage, avgColor, healthCounts } = useMemo(() => {
    const avg =
      data.guardianStats.length > 0
        ? Math.round(
            data.guardianStats.reduce((sum, g) => sum + g.percentage, 0) / data.guardianStats.length
          )
        : 0;
    return {
      avgPercentage: avg,
      avgColor: getHealthColor(getHealthStatus(avg)),
      healthCounts: countByHealth(data.guardianStats, (g) => g.percentage),
    };
  }, [data.guardianStats]);

  return (
    <Box sx={{ ...ROW_SX, flexDirection: 'column', alignItems: 'stretch' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: isExpanded ? 1 : 0,
        }}
      >
        <IconButton size="small" onClick={() => onToggle(data.chainId)} sx={{ p: 0.25 }}>
          {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
        <Tooltip title={onChainClick ? 'Click to view chain details' : ''}>
          <Box
            role={onChainClick ? 'button' : undefined}
            tabIndex={onChainClick ? 0 : undefined}
            onClick={() => onChainClick?.(data.chainId)}
            onKeyDown={(e) => {
              if (onChainClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onChainClick(data.chainId);
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: onChainClick ? 'pointer' : 'default',
              borderRadius: 1,
              px: 1,
              py: 0.5,
              transition: 'background-color 0.1s',
              '&:hover': onChainClick ? { bgcolor: 'action.hover' } : {},
            }}
          >
            {chainIcon && <img src={chainIcon} alt={data.chainName} width={20} height={20} />}
            <Typography variant="body2" fontWeight="medium" sx={{ minWidth: 120 }}>
              {data.chainName}
            </Typography>
            <Typography variant="body2" color={`${avgColor}.main`} fontWeight="bold">
              {avgPercentage}% avg
            </Typography>
          </Box>
        </Tooltip>
        {/* Show compact health summary when collapsed */}
        {!isExpanded && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
            {healthCounts.error > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <ErrorOutline color="error" sx={{ fontSize: 16 }} />
                <Typography variant="caption" color="error.main">
                  {healthCounts.error}
                </Typography>
              </Box>
            )}
            {healthCounts.warning > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <WarningAmberOutlined color="warning" sx={{ fontSize: 16 }} />
                <Typography variant="caption" color="warning.main">
                  {healthCounts.warning}
                </Typography>
              </Box>
            )}
            {healthCounts.healthy > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <CheckCircleOutline color="success" sx={{ fontSize: 16 }} />
                <Typography variant="caption" color="success.main">
                  {healthCounts.healthy}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
      {isExpanded && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
          {sortedGuardians.map((guardian) => (
            <GuardianPill
              key={guardian.guardianAddress}
              guardian={guardian}
              vaaCount={data.vaaCount}
              onClick={onGuardianClick}
            />
          ))}
        </Box>
      )}
    </Box>
  );
});

function LiveVaaStatus() {
  const { currentNetwork } = useNetworkContext();
  const { search, pathname } = useLocation();
  const history = useHistory();
  const isMainnet = currentNetwork.env === 'Mainnet';

  // Parse initial view mode from URL query params
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(search);
    const view = params.get('view');
    if (view && ['aggregate', 'byChain', 'byGuardian'].includes(view)) {
      return view as ViewMode;
    }
    return 'aggregate';
  });
  const [selectedChainId, setSelectedChainId] = useState<ChainId>(2); // Default to Ethereum
  const [selectedGuardian, setSelectedGuardian] = useState(GUARDIAN_NAMES[0]);
  const [statsWrapper, setStatsWrapper] = useState<DataWrapper<GuardianStatsResponse>>(
    getEmptyDataWrapper()
  );
  const [guardianChainStats, setGuardianChainStats] = useState<DataWrapper<ChainGuardianStat[]>>(
    getEmptyDataWrapper()
  );
  const [aggregateData, setAggregateData] = useState<DataWrapper<AggregateChainData[]>>(
    getEmptyDataWrapper()
  );
  const [sortField, setSortField] = useState<SortField>('percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [chainSortField, setChainSortField] = useState<ChainSortField>('percentage');
  const [chainSortDirection, setChainSortDirection] = useState<SortDirection>('asc');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('recent');
  const [shimFilter, setShimFilter] = useState<ShimFilter>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Initialize with all chains expanded
  const [expandedChains, setExpandedChains] = useState<Set<number>>(
    () => new Set(SUPPORTED_CHAIN_IDS)
  );

  // Sync view mode to URL query params
  useEffect(() => {
    const params = new URLSearchParams(search);
    const currentView = params.get('view');
    if (currentView !== viewMode) {
      params.set('view', viewMode);
      history.replace({ pathname, search: `?${params.toString()}` });
    }
  }, [viewMode, pathname, history, search]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleChainSort = (field: ChainSortField) => {
    if (chainSortField === field) {
      setChainSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setChainSortField(field);
      setChainSortDirection('asc');
    }
  };

  // Fetch when chain changes or time frame changes
  useEffect(() => {
    if (viewMode !== 'byChain') return;

    let cancelled = false;
    setStatsWrapper((w) => ({ ...w, isFetching: true, error: null }));

    const url = getApiUrl(selectedChainId, timeFrame, shimFilter);

    axios
      .get<GuardianStatsResponse>(url)
      .then((response) => {
        if (!cancelled) {
          setStatsWrapper(receiveDataWrapper(response.data));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatsWrapper((w) => ({
            ...w,
            isFetching: false,
            error: error?.message || 'Failed to fetch guardian stats',
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [viewMode, selectedChainId, timeFrame, shimFilter, refreshTrigger]);

  // Fetch guardian stats across all chains when in byGuardian mode
  useEffect(() => {
    if (viewMode !== 'byGuardian') return;

    let cancelled = false;
    setGuardianChainStats((w) => ({ ...w, isFetching: true, error: null }));

    // Fetch all chains in parallel
    Promise.all(
      SUPPORTED_CHAIN_IDS.map((chainId) =>
        axios
          .get<GuardianStatsResponse>(getApiUrl(chainId, timeFrame, shimFilter))
          .then((res) => res.data)
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;

      const chainStats: ChainGuardianStat[] = [];
      for (const data of results) {
        if (!data) continue;
        const guardianStat = data.guardianStats.find((g) => g.guardianName === selectedGuardian);
        if (guardianStat) {
          chainStats.push({
            chainId: data.chainId,
            chainName: data.chainName,
            percentage: guardianStat.percentage,
            observationCount: guardianStat.observationCount,
            vaaCount: data.vaaCount,
            lastSignedTx: guardianStat.lastSignedTx,
            lastSignedAt: guardianStat.lastSignedAt,
          });
        }
      }

      setGuardianChainStats(receiveDataWrapper(chainStats));
    });

    return () => {
      cancelled = true;
    };
  }, [viewMode, selectedGuardian, timeFrame, shimFilter, refreshTrigger]);

  // Fetch all chain stats for aggregate view
  useEffect(() => {
    if (viewMode !== 'aggregate') return;

    let cancelled = false;
    setAggregateData((w) => ({ ...w, isFetching: true, error: null }));

    Promise.all(
      SUPPORTED_CHAIN_IDS.map((chainId) =>
        axios
          .get<GuardianStatsResponse>(getApiUrl(chainId, timeFrame, shimFilter))
          .then((res) => res.data)
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;

      const chainData: AggregateChainData[] = [];
      for (const data of results) {
        if (!data) continue;
        chainData.push({
          chainId: data.chainId,
          chainName: data.chainName,
          vaaCount: data.vaaCount,
          guardianStats: data.guardianStats,
        });
      }

      // Sort chains by name
      chainData.sort((a, b) => a.chainName.localeCompare(b.chainName));
      setAggregateData(receiveDataWrapper(chainData));
    });

    return () => {
      cancelled = true;
    };
  }, [viewMode, timeFrame, shimFilter, refreshTrigger]);

  const handleChainChange = (event: SelectChangeEvent<number>) => {
    setSelectedChainId(event.target.value as ChainId);
  };

  const handleGuardianChange = (event: SelectChangeEvent<string>) => {
    setSelectedGuardian(event.target.value);
  };

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode) setViewMode(newMode);
  };

  const handleTimeFrameChange = (
    _: React.MouseEvent<HTMLElement>,
    newTimeFrame: TimeFrame | null
  ) => {
    if (newTimeFrame) setTimeFrame(newTimeFrame);
  };

  const handleShimFilterChange = (
    _: React.MouseEvent<HTMLElement>,
    newShimFilter: ShimFilter | null
  ) => {
    if (newShimFilter) setShimFilter(newShimFilter);
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Navigation handlers for aggregate view
  const handleAggregateChainClick = (chainId: number) => {
    setSelectedChainId(chainId as ChainId);
    setViewMode('byChain');
  };

  const handleAggregateGuardianClick = (guardianName: string) => {
    setSelectedGuardian(guardianName);
    setViewMode('byGuardian');
  };

  // Expand/collapse handlers for aggregate view
  const handleToggleChainExpand = (chainId: number) => {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(chainId)) {
        next.delete(chainId);
      } else {
        next.add(chainId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedChains(new Set(SUPPORTED_CHAIN_IDS));
  };

  const handleCollapseAll = () => {
    setExpandedChains(new Set());
  };

  const allExpanded = expandedChains.size === SUPPORTED_CHAIN_IDS.length;

  const healthCounts = useMemo(() => {
    if (!statsWrapper.data) return { healthy: 0, warning: 0, error: 0 };
    return countByHealth(statsWrapper.data.guardianStats, (g) => g.percentage);
  }, [statsWrapper.data]);

  const sortedGuardians = useMemo(() => {
    if (!statsWrapper.data) return [];
    const guardians = [...statsWrapper.data.guardianStats];
    guardians.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'guardianName':
          comparison = a.guardianName.localeCompare(b.guardianName);
          break;
        case 'percentage':
          comparison = a.percentage - b.percentage;
          break;
        case 'lastSignedAt':
          comparison = new Date(a.lastSignedAt).getTime() - new Date(b.lastSignedAt).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return guardians;
  }, [statsWrapper.data, sortField, sortDirection]);

  const chainIcon = getChainIcon(selectedChainId);

  const sortedChainStats = useMemo(() => {
    if (!guardianChainStats.data) return [];
    const stats = [...guardianChainStats.data];
    stats.sort((a, b) => {
      let comparison = 0;
      switch (chainSortField) {
        case 'chainName':
          comparison = a.chainName.localeCompare(b.chainName);
          break;
        case 'percentage':
          comparison = a.percentage - b.percentage;
          break;
      }
      return chainSortDirection === 'asc' ? comparison : -comparison;
    });
    return stats;
  }, [guardianChainStats.data, chainSortField, chainSortDirection]);

  const guardianHealthCounts = useMemo(() => {
    if (!guardianChainStats.data) return { healthy: 0, warning: 0, error: 0 };
    return countByHealth(guardianChainStats.data, (s) => s.percentage);
  }, [guardianChainStats.data]);

  const aggregateHealthCounts = useMemo(() => {
    if (!aggregateData.data) return { healthy: 0, warning: 0, error: 0 };
    // Count individual guardian stats across all chains
    const allGuardianStats = aggregateData.data.flatMap((chain) => chain.guardianStats);
    return countByHealth(allGuardianStats, (g) => g.percentage);
  }, [aggregateData.data]);

  // Problem guardians: guardians with error on 3+ chains
  const errorGuardians = useMemo(() => {
    if (!aggregateData.data) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const chain of aggregateData.data) {
      for (const guardian of chain.guardianStats) {
        if (guardian.percentage < HEALTH_THRESHOLDS.warning) {
          counts.set(guardian.guardianName, (counts.get(guardian.guardianName) || 0) + 1);
        }
      }
    }
    return counts;
  }, [aggregateData.data]);

  // Warning guardians: guardians with warning (but not error) on 3+ chains
  const warningGuardians = useMemo(() => {
    if (!aggregateData.data) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const chain of aggregateData.data) {
      for (const guardian of chain.guardianStats) {
        if (
          guardian.percentage >= HEALTH_THRESHOLDS.warning &&
          guardian.percentage < HEALTH_THRESHOLDS.healthy
        ) {
          counts.set(guardian.guardianName, (counts.get(guardian.guardianName) || 0) + 1);
        }
      }
    }
    return counts;
  }, [aggregateData.data]);

  // Summary stats for aggregate view
  const summaryStats = useMemo(() => {
    if (!aggregateData.data)
      return { chainsWithIssues: 0, errorGuardiansCount: 0, warningGuardiansCount: 0 };
    const chainsWithIssues = aggregateData.data.filter((chain) => {
      const avg =
        chain.guardianStats.reduce((sum, g) => sum + g.percentage, 0) / chain.guardianStats.length;
      return avg < HEALTH_THRESHOLDS.healthy;
    }).length;
    const errorGuardiansCount = [...errorGuardians.values()].filter((count) => count > 0).length;
    const warningGuardiansCount = [...warningGuardians.values()].filter(
      (count) => count >= PROBLEM_GUARDIAN_CHAIN_THRESHOLD
    ).length;
    return { chainsWithIssues, errorGuardiansCount, warningGuardiansCount };
  }, [aggregateData.data, errorGuardians, warningGuardians]);

  // Redirect to home if not on mainnet, preserving query params
  if (!isMainnet) {
    return <Redirect to={`/${search}`} />;
  }

  return (
    <CollapsibleSection
      defaultExpanded={true}
      header={
        <Box sx={{ display: 'flex', alignItems: 'center', paddingRight: 1 }}>
          <Box>Live VAA Signing Status</Box>
          <Tooltip
            title={
              <Typography variant="body2">
                Shows guardian signing performance for the selected time frame. Guardians with
                &gt;=76% are healthy, 51-75% are warning, and &lt;=50% indicate issues.
              </Typography>
            }
          >
            <Box>
              <InfoOutlined sx={{ fontSize: '.8em', ml: 0.5 }} />
            </Box>
          </Tooltip>
          <Box flexGrow={1} />
          {viewMode === 'aggregate' && aggregateData.data && (
            <HealthSummary counts={aggregateHealthCounts} />
          )}
          {viewMode === 'byChain' && statsWrapper.data && <HealthSummary counts={healthCounts} />}
          {viewMode === 'byGuardian' && guardianChainStats.data && (
            <HealthSummary counts={guardianHealthCounts} />
          )}
        </Box>
      }
    >
      <Box p={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
          >
            <ToggleButton value="aggregate">Aggregate</ToggleButton>
            <ToggleButton value="byChain">By Chain</ToggleButton>
            <ToggleButton value="byGuardian">By Guardian</ToggleButton>
          </ToggleButtonGroup>

          {viewMode === 'byChain' && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="chain-select-label">Chain</InputLabel>
              <Select
                labelId="chain-select-label"
                value={selectedChainId}
                label="Chain"
                onChange={handleChainChange}
              >
                {SUPPORTED_CHAIN_IDS.map((chainId) => {
                  const icon = getChainIcon(chainId);
                  let chainName: string;
                  try {
                    chainName = chainIdToChain(chainId);
                  } catch {
                    chainName = `Chain ${chainId}`;
                  }
                  return (
                    <MenuItem key={chainId} value={chainId}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {icon && <img src={icon} alt={chainName} width={20} height={20} />}
                        {chainName}
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          )}

          {viewMode === 'byGuardian' && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="guardian-select-label">Guardian</InputLabel>
              <Select
                labelId="guardian-select-label"
                value={selectedGuardian}
                label="Guardian"
                onChange={handleGuardianChange}
              >
                {GUARDIAN_NAMES.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <ToggleButtonGroup
            value={timeFrame}
            exclusive
            onChange={handleTimeFrameChange}
            size="small"
          >
            <ToggleButton value="recent">Last 20 min</ToggleButton>
            <ToggleButton value="daily">Last 24 hours</ToggleButton>
          </ToggleButtonGroup>

          <Tooltip title="Filter Solana/Fogo by shim or native transactions">
            <ToggleButtonGroup
              value={shimFilter}
              exclusive
              onChange={handleShimFilterChange}
              size="small"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="shim">Shim</ToggleButton>
              <ToggleButton value="native">Native</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>

          <Button
            variant="outlined"
            size="small"
            onClick={handleRefresh}
            startIcon={<Refresh />}
            disabled={
              (viewMode === 'aggregate' && aggregateData.isFetching) ||
              (viewMode === 'byChain' && statsWrapper.isFetching) ||
              (viewMode === 'byGuardian' && guardianChainStats.isFetching)
            }
          >
            Refresh
          </Button>
        </Box>

        {/* Aggregate View */}
        {viewMode === 'aggregate' && (
          <>
            <Box
              sx={{
                mb: 2,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  All Chains - Guardian signing rates across {aggregateData.data?.length || 0}{' '}
                  chains
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Click chain names for details, click pills to view guardian performance
                </Typography>
              </Box>
              <Tooltip title={allExpanded ? 'Collapse all chains' : 'Expand all chains'}>
                <IconButton
                  size="small"
                  onClick={allExpanded ? handleCollapseAll : handleExpandAll}
                  sx={{ ml: 1 }}
                >
                  {allExpanded ? <UnfoldLess /> : <UnfoldMore />}
                </IconButton>
              </Tooltip>
            </Box>

            {/* Summary bar showing issues at a glance */}
            {aggregateData.data &&
              (summaryStats.chainsWithIssues > 0 ||
                summaryStats.errorGuardiansCount > 0 ||
                summaryStats.warningGuardiansCount > 0) && (
                <Box
                  sx={{
                    mb: 2,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                  }}
                >
                  {summaryStats.chainsWithIssues > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb:
                          summaryStats.errorGuardiansCount > 0 ||
                          summaryStats.warningGuardiansCount > 0
                            ? 1.5
                            : 0,
                      }}
                    >
                      <WarningAmberOutlined color="warning" />
                      <Typography variant="body2">
                        <strong>{summaryStats.chainsWithIssues}</strong> chain
                        {summaryStats.chainsWithIssues !== 1 ? 's' : ''} with below-average signing
                        rates
                      </Typography>
                    </Box>
                  )}
                  {summaryStats.errorGuardiansCount > 0 && (
                    <Box sx={{ mb: summaryStats.warningGuardiansCount > 0 ? 1.5 : 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <ErrorOutline color="error" />
                        <Typography variant="body2">
                          <strong>{summaryStats.errorGuardiansCount}</strong> guardian
                          {summaryStats.errorGuardiansCount !== 1 ? 's' : ''} highly
                          underperforming:
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 4 }}>
                        {[...errorGuardians.entries()]
                          .filter(([, count]) => count > 0)
                          .sort((a, b) => b[1] - a[1])
                          .map(([name, count]) => (
                            <Box
                              key={name}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleAggregateGuardianClick(name)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleAggregateGuardianClick(name);
                                }
                              }}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                bgcolor: 'error.main',
                                color: 'common.black',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'transform 0.1s, box-shadow 0.1s',
                                '&:hover': {
                                  transform: 'translateY(-1px)',
                                  boxShadow: 2,
                                },
                              }}
                            >
                              <span>{name}</span>
                              <Typography
                                component="span"
                                sx={{ fontSize: '0.7rem', opacity: 0.8 }}
                              >
                                ({count} chains)
                              </Typography>
                            </Box>
                          ))}
                      </Box>
                    </Box>
                  )}
                  {summaryStats.warningGuardiansCount > 0 && (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <WarningAmberOutlined color="warning" />
                        <Typography variant="body2">
                          <strong>{summaryStats.warningGuardiansCount}</strong> guardian
                          {summaryStats.warningGuardiansCount !== 1 ? 's' : ''} in warning state on{' '}
                          {PROBLEM_GUARDIAN_CHAIN_THRESHOLD}+ chains:
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 4 }}>
                        {[...warningGuardians.entries()]
                          .filter(([, count]) => count >= PROBLEM_GUARDIAN_CHAIN_THRESHOLD)
                          .sort((a, b) => b[1] - a[1])
                          .map(([name, count]) => (
                            <Box
                              key={name}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleAggregateGuardianClick(name)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleAggregateGuardianClick(name);
                                }
                              }}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                bgcolor: 'warning.main',
                                color: 'common.black',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'transform 0.1s, box-shadow 0.1s',
                                '&:hover': {
                                  transform: 'translateY(-1px)',
                                  boxShadow: 2,
                                },
                              }}
                            >
                              <span>{name}</span>
                              <Typography
                                component="span"
                                sx={{ fontSize: '0.7rem', opacity: 0.8 }}
                              >
                                ({count} chains)
                              </Typography>
                            </Box>
                          ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

            <LoadingErrorState isLoading={aggregateData.isFetching} error={aggregateData.error} />

            {!aggregateData.isFetching &&
              !aggregateData.error &&
              (!aggregateData.data || aggregateData.data.length === 0) && (
                <Typography color="text.secondary" p={2}>
                  No guardian stats available.
                </Typography>
              )}

            {!aggregateData.isFetching &&
              !aggregateData.error &&
              aggregateData.data &&
              aggregateData.data.length > 0 && (
                <Box sx={TABLE_CONTAINER_SX}>
                  <Box sx={TABLE_HEADER_SX}>
                    <Typography variant="subtitle2" sx={{ minWidth: 180 }}>
                      Chain
                    </Typography>
                    <Typography variant="subtitle2" sx={{ flex: 1 }}>
                      Guardian Signing Rates
                    </Typography>
                  </Box>
                  {aggregateData.data.map((chainData) => (
                    <AggregateRow
                      key={chainData.chainId}
                      data={chainData}
                      isExpanded={expandedChains.has(chainData.chainId)}
                      onToggle={handleToggleChainExpand}
                      onChainClick={handleAggregateChainClick}
                      onGuardianClick={handleAggregateGuardianClick}
                    />
                  ))}
                </Box>
              )}
          </>
        )}

        {/* By Chain View */}
        {viewMode === 'byChain' && (
          <>
            {statsWrapper.data && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                {chainIcon && (
                  <img src={chainIcon} alt={statsWrapper.data.chainName} width={24} height={24} />
                )}
                <Typography variant="body1" fontWeight="medium">
                  {statsWrapper.data.chainName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {statsWrapper.data.vaaCount} VAAs
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  (Updated: {new Date(statsWrapper.data.endTime).toLocaleString()})
                </Typography>
              </Box>
            )}

            <LoadingErrorState isLoading={statsWrapper.isFetching} error={statsWrapper.error} />

            {!statsWrapper.isFetching && !statsWrapper.error && !statsWrapper.data && (
              <Typography color="text.secondary" p={2}>
                No guardian stats available.
              </Typography>
            )}

            {!statsWrapper.isFetching && !statsWrapper.error && statsWrapper.data && (
              <Box sx={TABLE_CONTAINER_SX}>
                <Box sx={TABLE_HEADER_SX}>
                  <SortableHeader
                    label="Guardian"
                    field="guardianName"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    sx={{ minWidth: 180 }}
                  />
                  <SortableHeader
                    label="Signing Rate"
                    field="percentage"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    sx={{ flex: 1, mx: 2 }}
                  />
                  <Typography variant="subtitle2" sx={{ minWidth: 100, textAlign: 'right' }}>
                    Observations
                  </Typography>
                  <SortableHeader
                    label="Last Signed"
                    field="lastSignedAt"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    sx={{ minWidth: 150, justifyContent: 'flex-end', ml: 2 }}
                  />
                </Box>
                {sortedGuardians.map((guardian) => (
                  <GuardianRow
                    key={guardian.guardianAddress}
                    guardian={guardian}
                    vaaCount={statsWrapper.data!.vaaCount}
                  />
                ))}
              </Box>
            )}
          </>
        )}

        {/* By Guardian View */}
        {viewMode === 'byGuardian' && (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body1" fontWeight="medium">
                {selectedGuardian} - Performance across {sortedChainStats.length} chains
              </Typography>
            </Box>

            <LoadingErrorState
              isLoading={guardianChainStats.isFetching}
              error={guardianChainStats.error}
            />

            {!guardianChainStats.isFetching &&
              !guardianChainStats.error &&
              sortedChainStats.length === 0 && (
                <Typography color="text.secondary" p={2}>
                  No guardian stats available.
                </Typography>
              )}

            {!guardianChainStats.isFetching &&
              !guardianChainStats.error &&
              sortedChainStats.length > 0 && (
                <Box sx={TABLE_CONTAINER_SX}>
                  <Box sx={TABLE_HEADER_SX}>
                    <SortableHeader
                      label="Chain"
                      field="chainName"
                      currentField={chainSortField}
                      direction={chainSortDirection}
                      onSort={handleChainSort}
                      sx={{ minWidth: 180 }}
                    />
                    <SortableHeader
                      label="Signing Rate"
                      field="percentage"
                      currentField={chainSortField}
                      direction={chainSortDirection}
                      onSort={handleChainSort}
                      sx={{ flex: 1, mx: 2 }}
                    />
                    <Typography variant="subtitle2" sx={{ minWidth: 120, textAlign: 'right' }}>
                      Observations
                    </Typography>
                    <Typography
                      variant="subtitle2"
                      sx={{ minWidth: 150, textAlign: 'right', ml: 2 }}
                    >
                      Last Signed
                    </Typography>
                  </Box>
                  {sortedChainStats.map((stat) => (
                    <ChainRow key={stat.chainId} stat={stat} />
                  ))}
                </Box>
              )}
          </>
        )}
      </Box>
    </CollapsibleSection>
  );
}

export default LiveVaaStatus;
