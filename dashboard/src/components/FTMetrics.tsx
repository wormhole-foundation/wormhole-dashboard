import { Box, Divider, Typography } from '@mui/material';
import { useNetworkContext } from '../contexts/NetworkContext';
import { LookerDashboard } from './LookerDashboard';

function FTMetrics() {
  const { currentNetwork } = useNetworkContext();
  if (currentNetwork.name === 'Mainnet') {
    return (
      <>
        <LookerDashboard
          title="Mainnet FT Transfers Report"
          src="https://lookerstudio.google.com/embed/reporting/6125e312-2e23-4385-8ba2-4c86f5f48e7f/page/p_fy15iz6kkd"
          hasTabs
        />
        <Divider />
      </>
    );
  }
  // Unsupported because Swap Layer is not deployed on Testnet
  return (
    <>
      <Box textAlign="center" my={8} mx={4}>
        <Typography variant="h3">FT Metrics are currently only supported in Mainnet</Typography>
      </Box>
    </>
  );
}
export default FTMetrics;
