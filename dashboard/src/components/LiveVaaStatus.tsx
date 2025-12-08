import {
  ArrowDownward,
  ArrowUpward,
  CheckCircleOutline,
  ErrorOutline,
  InfoOutlined,
  Launch,
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
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { chainIdToChain, ChainId } from '@wormhole-foundation/sdk-base';
import { chainToIcon } from '@wormhole-foundation/sdk-icons';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Redirect, useLocation } from 'react-router-dom';
import { useNetworkContext } from '../contexts/NetworkContext';
import { DataWrapper, getEmptyDataWrapper, receiveDataWrapper } from '../utils/DataWrapper';
import CollapsibleSection from './CollapsibleSection';

// Constants
const API_BASE_URL = 'https://api.corinth.gfx.town/api/v1/msc/guardian-stats';
const HEALTH_THRESHOLDS = { healthy: 76, warning: 51 } as const;

// Types
type SortField = 'guardianName' | 'percentage' | 'lastSignedAt';
type ChainSortField = 'chainName' | 'percentage';
type SortDirection = 'asc' | 'desc';
type HealthStatus = 'healthy' | 'warning' | 'error';

// Helper functions
function getHealthStatus(percentage: number): HealthStatus {
  if (percentage >= HEALTH_THRESHOLDS.healthy) return 'healthy';
  if (percentage >= HEALTH_THRESHOLDS.warning) return 'warning';
  return 'error';
}

function getHealthColor(status: HealthStatus): 'success' | 'warning' | 'error' {
  return status === 'healthy' ? 'success' : status;
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
  updatedAt: string;
  guardianStats: GuardianStat[];
}

// Active chains for monitoring (excludes deprecated chains like Fantom, Klaytn, Mantle)
const SUPPORTED_CHAIN_IDS: ChainId[] = [
  1, // Solana
  2, // Ethereum
  4, // BSC
  5, // Polygon
  6, // Avalanche
  14, // Celo
  15, // Near
  16, // Moonbeam
  19, // Injective
  21, // Sui
  22, // Aptos
  23, // Arbitrum
  24, // Optimism
  30, // Base
  32, // Sei
  34, // Scroll
  37, // X Layer
  38, // Linea
  39, // Berachain
  40, // Seievm
  44, // Unichain
  45, // World Chain
  46, // Ink
  48, // Monad
  50, // Mezo
  51, // Fogo
  57, // XRPL-EVM
  3104, // Wormchain
] as ChainId[];

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

function HealthSummary({ counts }: { counts: { healthy: number; warning: number; error: number } }) {
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

function LoadingErrorState({
  isLoading,
  error,
}: {
  isLoading: boolean;
  error: string | null;
}) {
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
      <Box sx={{ minWidth: 150, textAlign: 'right', ml: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
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

// Helper to format date for datetime-local input
function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Helper to get default time range (last 24 hours)
function getDefaultTimeRange() {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
  return {
    startTime: formatDateTimeLocal(startTime),
    endTime: formatDateTimeLocal(endTime),
  };
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

type ViewMode = 'byChain' | 'byGuardian';

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
      <Box sx={{ minWidth: 150, textAlign: 'right', ml: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
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

function LiveVaaStatus() {
  const { currentNetwork } = useNetworkContext();
  const { search } = useLocation();
  const isMainnet = currentNetwork.env === 'Mainnet';

  const [viewMode, setViewMode] = useState<ViewMode>('byChain');
  const [selectedChainId, setSelectedChainId] = useState<ChainId>(2); // Default to Ethereum
  const [selectedGuardian, setSelectedGuardian] = useState(GUARDIAN_NAMES[0]);
  const [statsWrapper, setStatsWrapper] = useState<DataWrapper<GuardianStatsResponse>>(
    getEmptyDataWrapper()
  );
  const [guardianChainStats, setGuardianChainStats] = useState<DataWrapper<ChainGuardianStat[]>>(
    getEmptyDataWrapper()
  );
  const [sortField, setSortField] = useState<SortField>('percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [chainSortField, setChainSortField] = useState<ChainSortField>('percentage');
  const [chainSortDirection, setChainSortDirection] = useState<SortDirection>('asc');
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [startTime, setStartTime] = useState(() => getDefaultTimeRange().startTime);
  const [endTime, setEndTime] = useState(() => getDefaultTimeRange().endTime);
  const [fetchTrigger, setFetchTrigger] = useState(0); // Used to trigger fetches

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

  const handleFetch = () => {
    setFetchTrigger((prev) => prev + 1);
  };

  // Fetch when chain changes (always), or when fetchTrigger changes (for time range)
  useEffect(() => {
    let cancelled = false;
    setStatsWrapper((w) => ({ ...w, isFetching: true, error: null }));

    let url = `${API_BASE_URL}/${selectedChainId}`;
    if (useTimeRange && startTime && endTime) {
      const startISO = new Date(startTime).toISOString();
      const endISO = new Date(endTime).toISOString();
      url += `?startTime=${encodeURIComponent(startISO)}&endTime=${encodeURIComponent(endISO)}`;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally exclude time range deps to avoid auto-fetching on input change (causes rate limiting)
  }, [selectedChainId, fetchTrigger]);

  // Fetch guardian stats across all chains when in byGuardian mode
  useEffect(() => {
    if (viewMode !== 'byGuardian') return;

    let cancelled = false;
    setGuardianChainStats((w) => ({ ...w, isFetching: true, error: null }));

    // Fetch all chains in parallel
    Promise.all(
      SUPPORTED_CHAIN_IDS.map((chainId) =>
        axios
          .get<GuardianStatsResponse>(`${API_BASE_URL}/${chainId}`)
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
  }, [viewMode, selectedGuardian, fetchTrigger]);

  const handleChainChange = (event: SelectChangeEvent<number>) => {
    setSelectedChainId(event.target.value as ChainId);
  };

  const handleGuardianChange = (event: SelectChangeEvent<string>) => {
    setSelectedGuardian(event.target.value);
  };

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode) setViewMode(newMode);
  };

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
                Shows guardian signing performance for the last 100 VAAs on the selected chain.
                Guardians with &gt;=76% are healthy, 51-75% are warning, and &lt;=50% indicate issues.
              </Typography>
            }
          >
            <Box>
              <InfoOutlined sx={{ fontSize: '.8em', ml: 0.5 }} />
            </Box>
          </Tooltip>
          <Box flexGrow={1} />
          {viewMode === 'byChain' && statsWrapper.data && (
            <HealthSummary counts={healthCounts} />
          )}
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
            <ToggleButton value="byChain">By Chain</ToggleButton>
            <ToggleButton value="byGuardian">By Guardian</ToggleButton>
          </ToggleButtonGroup>

          {viewMode === 'byChain' ? (
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
          ) : (
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

          {viewMode === 'byChain' && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Time Range
                </Typography>
                <Switch
                  size="small"
                  checked={useTimeRange}
                  onChange={(e) => setUseTimeRange(e.target.checked)}
                />
              </Box>
              {useTimeRange && (
                <>
                  <TextField
                    label="Start Time"
                    type="datetime-local"
                    size="small"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 200 }}
                  />
                  <TextField
                    label="End Time"
                    type="datetime-local"
                    size="small"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 200 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleFetch}
                    disabled={statsWrapper.isFetching}
                  >
                    Fetch
                  </Button>
                </>
              )}
            </>
          )}
        </Box>
        {/* By Chain View */}
        {viewMode === 'byChain' && (
          <>
            {statsWrapper.data && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                {chainIcon && (
                  <img
                    src={chainIcon}
                    alt={statsWrapper.data.chainName}
                    width={24}
                    height={24}
                  />
                )}
                <Typography variant="body1" fontWeight="medium">
                  {statsWrapper.data.chainName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {statsWrapper.data.vaaCount} VAAs
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  (Updated: {new Date(statsWrapper.data.updatedAt).toLocaleString()})
                </Typography>
              </Box>
            )}

            <LoadingErrorState
              isLoading={statsWrapper.isFetching}
              error={statsWrapper.error}
            />

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

            {!guardianChainStats.isFetching && !guardianChainStats.error && sortedChainStats.length === 0 && (
              <Typography color="text.secondary" p={2}>
                No guardian stats available.
              </Typography>
            )}

            {!guardianChainStats.isFetching && !guardianChainStats.error && sortedChainStats.length > 0 && (
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
                  <Typography variant="subtitle2" sx={{ minWidth: 150, textAlign: 'right', ml: 2 }}>
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
