import { Divider } from "@mui/material";
import { useNetworkContext } from "../contexts/NetworkContext";
import useChainHeartbeats from "../hooks/useChainHeartbeats";
import useHeartbeats from "../hooks/useHeartbeats";
import Accountant from "./Accountant";
import Alerts from "./Alerts";
import Chains from "./Chains";
import CollapsibleSection from "./CollapsibleSection";
import Governor from "./Governor";
import Guardians from "./Guardians";
import MainnetGovernor from "./MainnetGovernor";

function Main() {
  const heartbeats = useHeartbeats();
  const chainIdsToHeartbeats = useChainHeartbeats(heartbeats);
  const { currentNetwork } = useNetworkContext();
  return (
    <>
      <Alerts
        heartbeats={heartbeats}
        chainIdsToHeartbeats={chainIdsToHeartbeats}
      />
      <Divider />
      <Chains chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Divider />
      <CollapsibleSection header="Guardians">
        <Guardians heartbeats={heartbeats} />
      </CollapsibleSection>
      <Divider />
      {currentNetwork.name === "Mainnet" ? (
        <>
          <CollapsibleSection header="Accountant">
            <Accountant />
          </CollapsibleSection>
          <Divider />
        </>
      ) : null}
      <CollapsibleSection header="Governor">
        {currentNetwork.name === "Mainnet" ? <MainnetGovernor /> : <Governor />}
      </CollapsibleSection>
    </>
  );
}
export default Main;
