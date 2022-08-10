import { ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import useGovernorInfo from "../hooks/useGovernorInfo";
import chainIdToName from "../utils/chainIdToName";

const calculatePercent = (remaining: string, limit: string): number => {
  try {
    return ((Number(limit) - Number(remaining)) / Number(limit)) * 100;
  } catch (e) {
    return 0;
  }
};

function Governor() {
  const governorInfo = useGovernorInfo();
  return (
    <>
      <Box p={2}>
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Chain</TableCell>
                  <TableCell>Limit</TableCell>
                  <TableCell>Remaining</TableCell>
                  <TableCell width="50%">Progress</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {governorInfo.notionals.map((notional) => (
                  <TableRow key={notional.chainId}>
                    <TableCell>{chainIdToName(notional.chainId)}</TableCell>
                    <TableCell>{notional.notionalLimit}</TableCell>
                    <TableCell>{notional.remainingAvailableNotional}</TableCell>
                    <TableCell>
                      <LinearProgress
                        variant="determinate"
                        value={calculatePercent(
                          notional.remainingAvailableNotional,
                          notional.notionalLimit
                        )}
                        color={
                          calculatePercent(
                            notional.remainingAvailableNotional,
                            notional.notionalLimit
                          ) > 80
                            ? "error"
                            : calculatePercent(
                                notional.remainingAvailableNotional,
                                notional.notionalLimit
                              ) > 50
                            ? "warning"
                            : "success"
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>
      <Box p={2}>
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Chain</TableCell>
                  <TableCell>Emitter</TableCell>
                  <TableCell>Sequence</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {governorInfo.enqueued.map((vaa) => (
                  <TableRow key={JSON.stringify(vaa)}>
                    <TableCell>
                      {chainIdToName(vaa.emitterChain)} ({vaa.emitterChain})
                    </TableCell>
                    <TableCell>{vaa.emitterAddress}</TableCell>
                    <TableCell>{vaa.sequence}</TableCell>
                  </TableRow>
                ))}
                {governorInfo.enqueued.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ textAlign: "center" }}>
                      No enqueued VAAs
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>
      <Box p={2}>
        <Card>
          <Accordion>
            <AccordionSummary
              expandIcon={<ExpandMore />}
              aria-controls="panel1a-content"
              id="panel1a-header"
            >
              <Typography>Tokens</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Chain</TableCell>
                      <TableCell>Token</TableCell>
                      <TableCell>Price</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {governorInfo.tokens.map((token) => (
                      <TableRow
                        key={`${token.originChainId}_${token.originAddress}`}
                      >
                        <TableCell>
                          {chainIdToName(token.originChainId)} (
                          {token.originChainId})
                        </TableCell>
                        <TableCell>{token.originAddress}</TableCell>
                        <TableCell>{token.price}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        </Card>
      </Box>
    </>
  );
}
export default Governor;
