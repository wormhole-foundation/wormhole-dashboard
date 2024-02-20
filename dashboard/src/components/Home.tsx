import { Divider } from '@mui/material';
import { MonitorSettingsProvider } from '../contexts/MonitorSettingsContext';
import { useNetworkContext } from '../contexts/NetworkContext';
import { ChainIdToHeartbeats } from '../hooks/useChainHeartbeats';
import useCloudGovernorInfo from '../hooks/useCloudGovernorInfo';
import { Heartbeat } from '../utils/getLastHeartbeats';
import Accountant from './Accountant';
import Chains from './Chains';
import CollapsibleSection from './CollapsibleSection';
import Governor from './Governor';
import Guardians from './Guardians';
import MainnetGovernor from './MainnetGovernor';
import Monitor from './Monitor';

function Home({
  heartbeats,
  chainIdsToHeartbeats,
  latestRelease,
}: {
  heartbeats: Heartbeat[];
  chainIdsToHeartbeats: ChainIdToHeartbeats;
  latestRelease: string | null;
}) {
  const { currentNetwork } = useNetworkContext();
  const governorInfo = useCloudGovernorInfo();
  return (
    <>
      <Chains chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Divider />
      <Guardians
        heartbeats={heartbeats}
        chainIdsToHeartbeats={chainIdsToHeartbeats}
        latestRelease={latestRelease}
      />
      <Divider />
      {currentNetwork.name === 'Mainnet' ? (
        <>
          <MainnetGovernor governorInfo={governorInfo} />
          <Divider />
          <Accountant governorInfo={governorInfo} />
          <Divider />
          <MonitorSettingsProvider>
            <CollapsibleSection header="Monitor">
              <Monitor governorInfo={governorInfo} />
            </CollapsibleSection>
          </MonitorSettingsProvider>
        </>
      ) : currentNetwork.name === 'Testnet' ? (
        <>
          <MonitorSettingsProvider>
            <CollapsibleSection header="Monitor">
              <Monitor />
            </CollapsibleSection>
          </MonitorSettingsProvider>
        </>
      ) : (
        <Governor />
      )}
    </>
  );
}
export default Home;
