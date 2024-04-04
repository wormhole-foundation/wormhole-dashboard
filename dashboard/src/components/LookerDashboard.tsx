import { Box } from '@mui/material';
import { ReactElement } from 'react';

function RatioWrapper({
  children,
  ratio = '56.25%' /* 16:9 */,
  paddingTop = 0,
}: {
  children: ReactElement;
  ratio?: string;
  paddingTop?: number;
}) {
  return (
    <Box display="flex" alignItems="center" justifyContent="center" mt={2} mx={2}>
      <Box maxWidth={1366} flexGrow={1}>
        <Box style={{ width: '100%', paddingTop, paddingBottom: ratio, position: 'relative' }}>
          <Box
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export function LookerDashboard({
  title,
  src,
  hasTabs = false,
}: {
  title: string;
  src: string;
  hasTabs?: boolean;
}) {
  return (
    <RatioWrapper paddingTop={hasTabs ? 65 : 0}>
      <iframe
        title={title}
        src={src}
        style={{
          border: 0,
          width: '100%',
          height: '100%',
        }}
        allowFullScreen
        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      ></iframe>
    </RatioWrapper>
  );
}
