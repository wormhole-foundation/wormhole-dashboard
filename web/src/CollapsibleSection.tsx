import { ExpandMore } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import { ReactNode } from 'react';

function CollapsibleSection({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <Accordion
      disableGutters
      TransitionProps={{ mountOnEnter: true, unmountOnExit: true }}
      sx={{
        // background: "transparent",
        my: 0.5,
        '&.Mui-expanded:first-of-type': {
          marginTop: 0.5,
        },
        '&:not(:last-child)': {
          borderBottom: 0,
        },
        '&:before': {
          display: 'none',
        },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>{header}</AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}
export default CollapsibleSection;
