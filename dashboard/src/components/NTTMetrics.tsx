import { Box, Divider } from '@mui/material';
import { useNetworkContext } from '../contexts/NetworkContext';
import CollapsibleSection from './CollapsibleSection';
import { LookerDashboard } from './LookerDashboard';
import { NTTRateLimits } from './NTTRateLimits';
import { NTTTotalSupplyAndLocked } from './NTTTotalSupplyAndLocked';

function NTTMetrics() {
  const { currentNetwork } = useNetworkContext();
  if (currentNetwork.name === 'Mainnet') {
    return (
      <>
        <LookerDashboard
          title="Mainnet NTT Transfers Report"
          src="https://lookerstudio.google.com/embed/reporting/0f20bce5-d442-4f39-8cc4-ced8bb73042a/page/kSKuD"
          hasTabs
        />
        <Divider />
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
              <Box>Rate Limit Capacity</Box>
            </Box>
          }
        >
          <NTTRateLimits />
        </CollapsibleSection>
        <Divider />
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
              <Box>Total Supply and Locked</Box>
            </Box>
          }
        >
          <NTTTotalSupplyAndLocked />
        </CollapsibleSection>
      </>
    );
  }
  // This is the Testnet leg
  return (
    <>
      <LookerDashboard
        title="Testnet NTT Transfers Report"
        src="https://lookerstudio.google.com/embed/reporting/a47057a8-15a0-4cc7-8086-eb00f5d09d2a/page/SPpuD"
      />
      <Divider />
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
            <Box>Rate Limit Capacity</Box>
          </Box>
        }
      >
        <NTTRateLimits />
      </CollapsibleSection>
      <Divider />
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
            <Box>Total Supply and Locked</Box>
          </Box>
        }
      >
        <NTTTotalSupplyAndLocked />
      </CollapsibleSection>
    </>
  );
}
export default NTTMetrics;
