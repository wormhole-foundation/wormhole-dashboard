import { Typography } from '@mui/material';

type Entry = {
  label: string;
  receivedAt: string | null;
  error?: any | null;
};

function FetchedAt({ entries }: { entries: Entry[] }) {
  const hasAny = entries.some((e) => e.receivedAt || e.error);
  if (!hasAny) return null;
  return (
    <Typography variant="body2" sx={{ mt: 2, textAlign: 'right' }}>
      {entries.map((entry, idx) => (
        <span key={entry.label}>
          {idx > 0 ? '; ' : ''}
          {entry.label} fetched{' '}
          {entry.receivedAt ? new Date(entry.receivedAt).toLocaleString() : '—'}
          {entry.error ? (
            <Typography component="span" color="error" variant="body2">
              {' '}
              {String(entry.error)}
            </Typography>
          ) : null}
        </span>
      ))}
      .
    </Typography>
  );
}

export default FetchedAt;
