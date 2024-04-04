import { Box, Tab, Tabs, Typography } from '@mui/material';
import React from 'react';
import { useNetworkContext } from '../contexts/NetworkContext';
import { LookerDashboard } from './LookerDashboard';

function Metrics() {
  const { currentNetwork } = useNetworkContext();
  const [value, setValue] = React.useState(0);
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };
  if (currentNetwork.name !== 'Mainnet') {
    return (
      <Box textAlign="center" my={8} mx={4}>
        <Typography variant="h3">Metrics are only supported in Mainnet</Typography>
      </Box>
    );
  }
  return (
    <>
      <Tabs value={value} onChange={handleChange} centered sx={{ minHeight: 36 }}>
        <Tab label="7 Day" sx={{ minHeight: 36, py: 0 }} />
        <Tab label="30 Day" sx={{ minHeight: 36, py: 0 }} />
      </Tabs>
      {value === 0 ? (
        <LookerDashboard
          title="7 Day Report"
          src="https://lookerstudio.google.com/embed/reporting/d2236e5e-bf1b-4bff-9a5c-f9a394fdeb68/page/p_o3mrmt3o8c"
          hasTabs
        />
      ) : (
        <LookerDashboard
          title="30 Day Report"
          src="https://lookerstudio.google.com/embed/reporting/8a014f09-2954-4437-ac46-3d83f20fe6df/page/p_o3mrmt3o8c"
          hasTabs
        />
      )}
    </>
  );
}
export default Metrics;
