import { Divider } from '@mui/material';
import { useNetworkContext } from '../contexts/NetworkContext';
import { ChainIdToHeartbeats } from '../hooks/useChainHeartbeats';
import useCloudGovernorInfo from '../hooks/useCloudGovernorInfo';
import { Heartbeat } from '../utils/getLastHeartbeats';
import Accountant from './Accountant';
import Chains from './Chains';
import Governor from './Governor';
import Guardians from './Guardians';
import MainnetGovernor from './MainnetGovernor';
import Monitor from './Monitor';
import useTokenData from '../hooks/useTokenData';
import {
  ACCOUNTANT_CONTRACT_ADDRESS,
  NTT_ACCOUNTANT_CONTRACT_ADDRESS_MAINNET,
} from '@wormhole-foundation/wormhole-monitor-common';

function Home({
  heartbeats,
  heartbeatsReceivedAt,
  chainIdsToHeartbeats,
  latestRelease,
}: {
  heartbeats: Heartbeat[];
  heartbeatsReceivedAt: string | null;
  chainIdsToHeartbeats: ChainIdToHeartbeats;
  latestRelease: string | null;
}) {
  const { currentNetwork } = useNetworkContext();
  const governorInfo = useCloudGovernorInfo();
  const { tokenData, receivedAt: tokenDataReceivedAt } = useTokenData();
  return (
    <>
      <Chains chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Divider />
      <Guardians
        heartbeats={heartbeats}
        heartbeatsReceivedAt={heartbeatsReceivedAt}
        chainIdsToHeartbeats={chainIdsToHeartbeats}
        latestRelease={latestRelease}
      />
      <Divider />
      {currentNetwork.name === 'Mainnet' ? (
        <>
          <MainnetGovernor governorInfo={governorInfo} />
          <Divider />
          <Accountant
            governorInfo={governorInfo}
            tokenData={tokenData}
            tokenDataReceivedAt={tokenDataReceivedAt}
            accountantAddress={ACCOUNTANT_CONTRACT_ADDRESS}
          />
          <Divider />
          <Accountant
            governorInfo={governorInfo}
            tokenData={tokenData}
            tokenDataReceivedAt={tokenDataReceivedAt}
            accountantAddress={NTT_ACCOUNTANT_CONTRACT_ADDRESS_MAINNET}
            isNTT
          />
          <Divider />
          <Monitor governorInfo={governorInfo} />
        </>
      ) : currentNetwork.name === 'Testnet' ? (
        <Monitor />
      ) : (
        <Governor />
      )}
    </>
  );
}
export default Home;
