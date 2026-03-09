import { DownloadOutlined } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import axios from 'axios';
import { useMemo, useState } from 'react';
import { Redirect, useLocation } from 'react-router-dom';
import { useNetworkContext } from '../contexts/NetworkContext';
import CollapsibleSection from './CollapsibleSection';
import { MSC_API_BASE_URL } from '../utils/consts';

const API_BASE_URL = `${MSC_API_BASE_URL}/slo-report`;
const MIN_YEAR = 2021;
const MAX_YEAR = 2030;
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
const YYYY_MM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_PICKER_SX = {
  width: 180,
  '& input::-webkit-calendar-picker-indicator': { filter: 'invert(1)' },
};

type Quarter = (typeof QUARTERS)[number];

type ValidationResult = { valid: true; warning?: string } | { valid: false; message: string };

// --- Helpers ---

function currentYear(): number {
  return new Date().getFullYear();
}

function currentQuarter(): Quarter {
  const month = new Date().getMonth();
  if (month < 3) return 'Q1';
  if (month < 6) return 'Q2';
  if (month < 9) return 'Q3';
  return 'Q4';
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function quarterStartMonth(quarter: Quarter): number {
  const index = QUARTERS.indexOf(quarter);
  return index * 3 + 1;
}

function quarterLabel(quarter: Quarter, year: number): string {
  const start = quarterStartMonth(quarter);
  const end = start + 2;
  const startName = new Date(year, start - 1).toLocaleString('default', { month: 'short' });
  const endName = new Date(year, end - 1).toLocaleString('default', { month: 'short' });
  return `${startName} - ${endName} ${year}`;
}

function isYearInRange(y: number): boolean {
  return y >= MIN_YEAR && y <= MAX_YEAR;
}

// --- Validation ---

function validateQuarter(quarter: Quarter, year: number): ValidationResult {
  if (!isYearInRange(year)) {
    return { valid: false, message: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.` };
  }
  const quarterEndMonth = quarterStartMonth(quarter) + 2;
  const quarterEnd = new Date(year, quarterEndMonth, 0);
  if (quarterEnd > new Date()) {
    return { valid: true, warning: 'This quarter has not ended yet. Report may be partial.' };
  }
  return { valid: true };
}

function validateRange(from: string, to: string): ValidationResult {
  if (!YYYY_MM_PATTERN.test(from)) {
    return { valid: false, message: 'From month must be in YYYY-MM format.' };
  }
  if (!YYYY_MM_PATTERN.test(to)) {
    return { valid: false, message: 'To month must be in YYYY-MM format.' };
  }
  if (from > to) {
    return { valid: false, message: '"From" must be before or equal to "To".' };
  }
  const fromYear = Number(from.split('-')[0]);
  const toYear = Number(to.split('-')[0]);
  if (!isYearInRange(fromYear) || !isYearInRange(toYear)) {
    return { valid: false, message: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.` };
  }
  const toDate = new Date(Number(to.split('-')[0]), Number(to.split('-')[1]), 0);
  if (toDate > new Date()) {
    return { valid: true, warning: 'Date range extends into the future. Report may be partial.' };
  }
  return { valid: true };
}

// --- Download ---

function buildReportUrl(
  mode: 'quarter' | 'range',
  params: { quarter: Quarter; year: number; from: string; to: string }
): string {
  if (mode === 'quarter') {
    const quarterNum = QUARTERS.indexOf(params.quarter) + 1;
    return `${API_BASE_URL}?quarter=${quarterNum}&year=${params.year}`;
  }
  return `${API_BASE_URL}?from=${params.from}&to=${params.to}`;
}

function buildFilename(
  mode: 'quarter' | 'range',
  params: { quarter: Quarter; year: number; from: string; to: string }
): string {
  if (mode === 'quarter') {
    return `slo-report-${params.quarter}-${params.year}.xlsx`;
  }
  return `slo-report-${params.from}-to-${params.to}.xlsx`;
}

function parseFilename(headers: Record<string, unknown>, fallback: string): string {
  const disposition = headers['content-disposition'];
  if (typeof disposition !== 'string') return fallback;
  const match = disposition.match(/filename="?([^";\n]+)"?/);
  return match ? match[1] : fallback;
}

function triggerBlobDownload(data: Blob, filename: string) {
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function parseApiError(err: unknown): Promise<string> {
  if (!axios.isAxiosError(err)) return 'An unexpected error occurred.';

  const status = err.response?.status;
  if (status === 503) return 'Grafana is not configured on the server. Contact an administrator.';
  if (status === 400) {
    try {
      const text = await (err.response?.data as Blob).text();
      return JSON.parse(text).error || 'Invalid parameters.';
    } catch {
      return 'Invalid parameters. Check your date inputs.';
    }
  }
  return `Server error (${status || 'unknown'}). Please try again later.`;
}

// --- Component ---

function SloReport() {
  const { currentNetwork } = useNetworkContext();
  const { search } = useLocation();

  const [mode, setMode] = useState<'quarter' | 'range'>('quarter');
  const [quarter, setQuarter] = useState<Quarter>(currentQuarter());
  const [year, setYear] = useState(currentYear());
  const [fromMonth, setFromMonth] = useState(currentMonth());
  const [toMonth, setToMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo<ValidationResult>(() => {
    if (mode === 'quarter') return validateQuarter(quarter, year);
    return validateRange(fromMonth, toMonth);
  }, [mode, quarter, year, fromMonth, toMonth]);

  if (currentNetwork.env !== 'Mainnet') {
    return <Redirect to={`/${search}`} />;
  }

  const params = { quarter, year, from: fromMonth, to: toMonth };

  const handleDownload = async () => {
    if (!validation.valid) return;
    setLoading(true);
    setError(null);

    try {
      const url = buildReportUrl(mode, params);
      const response = await axios.get(url, { responseType: 'blob' });
      const fallbackName = buildFilename(mode, params);
      const filename = parseFilename(response.headers, fallbackName);
      triggerBlobDownload(response.data, filename);
    } catch (err) {
      setError(await parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const yearOutOfRange = !isYearInRange(year);

  return (
    <CollapsibleSection defaultExpanded={true} header="SLO Report">
      <Box p={2}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Generate and download an Excel SLO scorecard from Grafana dashboard data. Select a quarter
          or custom date range, then click download.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => {
              if (v) {
                setMode(v);
                setError(null);
              }
            }}
            size="small"
          >
            <ToggleButton value="quarter">Quarter</ToggleButton>
            <ToggleButton value="range">Date Range</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'quarter' && (
            <>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel id="quarter-select-label">Quarter</InputLabel>
                <Select
                  labelId="quarter-select-label"
                  value={quarter}
                  label="Quarter"
                  onChange={(e: SelectChangeEvent<Quarter>) =>
                    setQuarter(e.target.value as Quarter)
                  }
                >
                  {QUARTERS.map((q) => (
                    <MenuItem key={q} value={q}>
                      {q}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Year"
                type="number"
                size="small"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                error={yearOutOfRange}
                helperText={yearOutOfRange ? `${MIN_YEAR}-${MAX_YEAR}` : undefined}
                inputProps={{ min: MIN_YEAR, max: MAX_YEAR }}
                sx={{ width: 110 }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ alignSelf: 'center', fontStyle: 'italic' }}
              >
                {quarterLabel(quarter, year)}
              </Typography>
            </>
          )}

          {mode === 'range' && (
            <>
              <TextField
                label="From"
                type="month"
                size="small"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={MONTH_PICKER_SX}
              />
              <TextField
                label="To"
                type="month"
                size="small"
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={MONTH_PICKER_SX}
              />
            </>
          )}

          <Button
            variant="contained"
            size="medium"
            onClick={handleDownload}
            disabled={loading || !validation.valid}
            startIcon={loading ? <CircularProgress size={18} /> : <DownloadOutlined />}
          >
            {loading ? 'Generating...' : 'Generate & Download'}
          </Button>
        </Box>

        {validation.valid && validation.warning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {validation.warning}
          </Alert>
        )}

        {!validation.valid && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {validation.message}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Box>
    </CollapsibleSection>
  );
}

export default SloReport;
