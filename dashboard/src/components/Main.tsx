import { Box, Divider, Typography } from "@mui/material";
import Alerts from "./Alerts";
import Chains from "./Chains";
import Guardians from "./Guardians";
import useChainHeartbeats from "../hooks/useChainHeartbeats";
import useHeartbeats from "../hooks/useHeartbeats";
import Governor from "./Governor";
function Main() {
  const heartbeats = useHeartbeats();
  const chainIdsToHeartbeats = useChainHeartbeats(heartbeats);
  return (
    <>
      <Alerts chainIdsToHeartbeats={chainIdsToHeartbeats} />
      <Divider />
      <Box pt={2} pl={2}>
        <Typography variant="h5">Guardians</Typography>
      </Box>
      <Box p={2}>
        <Guardians heartbeats={heartbeats} />
      </Box>
      <Divider />
      <Box pt={2} pl={2}>
        <Typography variant="h5">Governor</Typography>
      </Box>
      <Governor />
      <Divider />
      <Box pt={2} pl={2}>
        <Typography variant="h5">Chains</Typography>
      </Box>
      <Chains chainIdsToHeartbeats={chainIdsToHeartbeats} />
    </>
  );
}
export default Main;
