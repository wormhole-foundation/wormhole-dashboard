import { Box } from "@mui/material";
import Alerts from "./Alerts";
import Chains from "./Chains";
import Guardians from "./Guardians";
import useChainHeartbeats from "../hooks/useChainHeartbeats";
import useHeartbeats from "../hooks/useHeartbeats";
function Main() {
  const heartbeats = useHeartbeats();
  const chainIdsToHeartbeats = useChainHeartbeats(heartbeats);
  return (
    <>
      <Alerts chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Box p={2}>
        <Guardians heartbeats={heartbeats} />
      </Box>
      <Chains chainIdsToHeartbeats={chainIdsToHeartbeats} />
    </>
  );
}
export default Main;
