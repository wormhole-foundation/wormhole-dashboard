import {
  coalesceChainName,
  ChainId,
} from "@certusone/wormhole-sdk/lib/esm/utils/consts";
import { Launch } from "@mui/icons-material";
import {
  Box,
  Checkbox,
  Container,
  FormControlLabel,
  FormGroup,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { explorerBlock, explorerTx, explorerVaa } from "./utils";

type VaasByBlock = { [block: number]: string[] };
type DB = { [chain in ChainId]?: VaasByBlock };

const TIMEOUT = 5 * 1000;

async function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

function App() {
  const [db, setDb] = useState<DB>({});
  const [showNumbers, setShowNumbers] = useState<boolean>(false);
  const handleToggleNumbers = useCallback(() => {
    setShowNumbers((v) => !v);
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const response = await axios.get<DB>("/api/db");
          if (response.data) {
            setDb(response.data);
          }
        } catch (e) {
          console.error(e);
        }
        await sleep(TIMEOUT);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Container>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox value={showNumbers} onChange={handleToggleNumbers} />
          }
          label="Show Numbers"
        />
      </FormGroup>
      {Object.entries(db).map(([chain, vaasByBlock]) => (
        <section key={chain}>
          <Typography variant="h5">
            {coalesceChainName(Number(chain) as ChainId)}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap" }}>
            {Object.entries(vaasByBlock).map(([block, vaas]) => (
              <Tooltip
                key={block}
                arrow
                title={
                  <Box>
                    <Typography>
                      Block {block}{" "}
                      <IconButton
                        href={explorerBlock(Number(chain) as ChainId, block)}
                        target="_blank"
                        size="small"
                      >
                        <Launch fontSize="inherit" />
                      </IconButton>
                    </Typography>
                    <Typography>VAAs</Typography>
                    {vaas.map((vaa) => (
                      <Box key={vaa}>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace" }}
                        >
                          {vaa.split(":")[0]}
                          <IconButton
                            href={explorerTx(
                              Number(chain) as ChainId,
                              vaa.split(":")[0]
                            )}
                            target="_blank"
                            size="small"
                          >
                            <Launch fontSize="inherit" />
                          </IconButton>
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", ml: 1 }}
                        >
                          {vaa.split(":")[1]}
                          <IconButton
                            href={explorerVaa(vaa.split(":")[1])}
                            target="_blank"
                            size="small"
                          >
                            <Launch fontSize="inherit" />
                          </IconButton>
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                }
              >
                <Box
                  sx={{
                    height: 16,
                    width: 16,
                    border: "1px solid black",
                    backgroundColor: vaas.length ? "green" : "#333",
                    fontSize: "10px",
                    textAlign: "center",
                    verticalAlign: "middle",
                  }}
                >
                  {showNumbers ? vaas.length : null}
                </Box>
              </Tooltip>
            ))}
          </Box>
        </section>
      ))}
    </Container>
  );
}

export default App;
