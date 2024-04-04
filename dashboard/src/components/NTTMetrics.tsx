import { Box, Typography } from '@mui/material';
import { useNetworkContext } from '../contexts/NetworkContext';
import { LookerDashboard } from './LookerDashboard';

function NTTMetrics() {
  const { currentNetwork } = useNetworkContext();
  if (currentNetwork.name !== 'Testnet') {
    return (
      <Box textAlign="center" my={8} mx={4}>
        <Typography variant="h3">NTT Metrics are only supported in Testnet</Typography>
      </Box>
    );
  }
  return (
    <>
      <LookerDashboard
        title="Testnet NTT Transfers Report"
        src="https://lookerstudio.google.com/embed/reporting/a47057a8-15a0-4cc7-8086-eb00f5d09d2a/page/SPpuD"
      />
    </>
  );
}
export default NTTMetrics;
