import { Divider } from '@mui/material';
import { MonitorSettingsProvider } from '../contexts/MonitorSettingsContext';
import { useNetworkContext } from '../contexts/NetworkContext';
import useChainHeartbeats from '../hooks/useChainHeartbeats';
import useCloudGovernorInfo from '../hooks/useCloudGovernorInfo';
import useHeartbeats from '../hooks/useHeartbeats';
import Accountant from './Accountant';
import Alerts from './Alerts';
import Chains from './Chains';
import CollapsibleSection from './CollapsibleSection';
import Governor from './Governor';
import Guardians from './Guardians';
import MainnetGovernor from './MainnetGovernor';
import Monitor from './Monitor';

function Main() {
  const heartbeats = useHeartbeats();
  const chainIdsToHeartbeats = useChainHeartbeats(heartbeats);
  const { currentNetwork } = useNetworkContext();
  const governorInfo = useCloudGovernorInfo();
  return (
    <>
      <Alerts heartbeats={heartbeats} chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Divider />
      <Chains chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Divider />
      <Guardians heartbeats={heartbeats} chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Divider />
      {currentNetwork.name === 'Mainnet' ? (
        <>
          <MainnetGovernor governorInfo={governorInfo} />
          <Divider />
          <CollapsibleSection header="Accountant">
            <Accountant governorInfo={governorInfo} />
          </CollapsibleSection>
          <Divider />
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
export default Main;
