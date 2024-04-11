import { useNetworkContext } from '../contexts/NetworkContext';
import { LookerDashboard } from './LookerDashboard';

function NTTMetrics() {
  const { currentNetwork } = useNetworkContext();
  if (currentNetwork.name === 'Mainnet') {
    return (
      <>
        <LookerDashboard
          title="Mainnet NTT Transfers Report"
          src="https://lookerstudio.google.com/embed/reporting/0f20bce5-d442-4f39-8cc4-ced8bb73042a/page/kSKuD"
        />
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
    </>
  );
}
export default NTTMetrics;
