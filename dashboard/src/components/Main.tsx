import { Divider } from "@mui/material";
import useChainHeartbeats from "../hooks/useChainHeartbeats";
import useHeartbeats from "../hooks/useHeartbeats";
import Alerts from "./Alerts";
import Chains from "./Chains";
import CollapsibleSection from "./CollapsibleSection";
import Governor from "./Governor";
import Guardians from "./Guardians";

function Main() {
  const heartbeats = useHeartbeats();
  const chainIdsToHeartbeats = useChainHeartbeats(heartbeats);
  return (
    <>
      <Alerts chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Divider />
      <CollapsibleSection header="Guardians">
        <Guardians heartbeats={heartbeats} />
      </CollapsibleSection>
      <Divider />
      <CollapsibleSection header="Governor">
        <Governor />
      </CollapsibleSection>
      <Divider />
      <CollapsibleSection header="Chains">
        <Chains chainIdsToHeartbeats={chainIdsToHeartbeats} />
      </CollapsibleSection>
    </>
  );
}
export default Main;
