import { Divider } from '@mui/material';
import { useNetworkContext } from '../contexts/NetworkContext';
import { ChainIdToHeartbeats } from '../hooks/useChainHeartbeats';
import useCloudGovernorInfo from '../hooks/useCloudGovernorInfo';
import {
  ACCOUNTANT_CONTRACT_ADDRESS,
  NTT_ACCOUNTANT_CONTRACT_ADDRESS_TESTNET,
} from '../utils/consts';
import { Heartbeat } from '../utils/getLastHeartbeats';
import Accountant from './Accountant';
import Chains from './Chains';
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
          <Accountant governorInfo={governorInfo} accountantAddress={ACCOUNTANT_CONTRACT_ADDRESS} />
          <Divider />
          <Monitor governorInfo={governorInfo} />
        </>
      ) : currentNetwork.name === 'Testnet' ? (
        <>
          <Accountant
            governorInfo={governorInfo}
            accountantAddress={NTT_ACCOUNTANT_CONTRACT_ADDRESS_TESTNET}
            isNTT
          />
          <Divider />
          <Monitor />
        </>
      ) : (
        <Governor />
      )}
    </>
  );
}
export default Home;
