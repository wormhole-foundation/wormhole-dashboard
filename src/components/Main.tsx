import { ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Typography,
} from "@mui/material";
import { ReactNode } from "react";
import useChainHeartbeats from "../hooks/useChainHeartbeats";
import useHeartbeats from "../hooks/useHeartbeats";
import Alerts from "./Alerts";
import Chains from "./Chains";
import Governor from "./Governor";
import Guardians from "./Guardians";

function CollapsibleSection({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <Accordion
      defaultExpanded
      disableGutters
      sx={{
        background: "transparent",
        my: 0.5,
        "&:not(:last-child)": {
          borderBottom: 0,
        },
        "&:before": {
          display: "none",
        },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography variant="h5">{header}</Typography>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

function Main() {
  const heartbeats = useHeartbeats();
  const chainIdsToHeartbeats = useChainHeartbeats(heartbeats);
  return (
    <>
      <Box p={2}>
        <Alerts chainIdsToHeartbeats={chainIdsToHeartbeats} />
      </Box>
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
