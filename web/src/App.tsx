import {
  ChainId,
  coalesceChainName,
} from "@certusone/wormhole-sdk/lib/esm/utils/consts";
import { Launch } from "@mui/icons-material";
import {
  Box,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  IconButton,
  SxProps,
  Theme,
  Tooltip,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import CollapsibleSection from "./CollapsibleSection";
import { explorerBlock, explorerTx, explorerVaa } from "./utils";

type VaasByBlock = { [block: number]: string[] };
type DB = { [chain in ChainId]?: VaasByBlock };

const TIMEOUT = 60 * 1000;
const inlineIconButtonSx: SxProps<Theme> = {
  fontSize: "1em",
  padding: 0,
  mt: -0.5,
};
const baseBlockSx: SxProps<Theme> = {
  height: 16,
  width: 16,
  border: "1px solid black",
  fontSize: "10px",
  textAlign: "center",
  verticalAlign: "middle",
};
const emptyBlockSx: SxProps<Theme> = {
  ...baseBlockSx,
  backgroundColor: "#333",
};
const doneBlockSx: SxProps<Theme> = {
  ...baseBlockSx,
  backgroundColor: "green",
};

async function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

function DetailBlocks({
  chain,
  vaasByBlock,
  showNumbers,
}: {
  chain: string;
  vaasByBlock: VaasByBlock;
  showNumbers: boolean;
}) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", mb: 2 }}>
      {Object.entries(vaasByBlock).map(([block, vaas]) => (
        <Tooltip
          key={block}
          arrow
          title={
            <Box>
              <Typography>
                Block {block.split("/")[0]}{" "}
                <IconButton
                  href={explorerBlock(
                    Number(chain) as ChainId,
                    block.split("/")[0]
                  )}
                  target="_blank"
                  size="small"
                  sx={inlineIconButtonSx}
                >
                  <Launch fontSize="inherit" />
                </IconButton>
              </Typography>
              <Typography variant="body2">
                {new Date(block.split("/")[1]).toLocaleString()}
              </Typography>
              <Typography>VAAs</Typography>
              {vaas.map((vaa) => (
                <Box key={vaa}>
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {vaa.split(":")[0]}{" "}
                    <IconButton
                      href={explorerTx(
                        Number(chain) as ChainId,
                        vaa.split(":")[0]
                      )}
                      target="_blank"
                      size="small"
                      sx={inlineIconButtonSx}
                    >
                      <Launch fontSize="inherit" />
                    </IconButton>
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: "monospace", ml: 1 }}
                  >
                    {vaa.split(":")[1]}{" "}
                    <IconButton
                      href={explorerVaa(vaa.split(":")[1])}
                      target="_blank"
                      size="small"
                      sx={inlineIconButtonSx}
                    >
                      <Launch fontSize="inherit" />
                    </IconButton>
                  </Typography>
                </Box>
              ))}
            </Box>
          }
        >
          <Box sx={vaas.length ? doneBlockSx : emptyBlockSx}>
            {showNumbers ? vaas.length : null}
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

function App() {
  const [dbWrapper, setDbWrapper] = useState<{
    lastFetched: string;
    nextFetch: number;
    isFetching: boolean;
    error: string;
    db: DB;
  }>({
    lastFetched: "",
    isFetching: true,
    nextFetch: Date.now(),
    error: "",
    db: {},
  });
  const [nextFetchPercent, setNextFetchPercent] = useState<number>(0);
  const db = dbWrapper.db;
  const nextFetch = dbWrapper.nextFetch;
  const [showNumbers, setShowNumbers] = useState<boolean>(false);
  const handleToggleNumbers = useCallback(() => {
    setShowNumbers((v) => !v);
  }, []);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const handleToggleAutoRefresh = useCallback(() => {
    setAutoRefresh((v) => !v);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const fetchDb = async () => {
      if (cancelled) return;
      setDbWrapper((r) => ({ ...r, isFetching: true, error: "" }));
      try {
        const response = await axios.get<DB>("/api/db");
        if (response.data && !cancelled) {
          setDbWrapper({
            lastFetched: new Date().toLocaleString(),
            nextFetch: Date.now() + TIMEOUT,
            isFetching: false,
            error: "",
            db: response.data,
          });
        }
      } catch (e: any) {
        setDbWrapper((r) => ({
          ...r,
          nextFetch: Date.now() + TIMEOUT,
          isFetching: false,
          error: e?.message || "An error occurred while fetching the database",
        }));
      }
    };
    (async () => {
      fetchDb();
      if (autoRefresh) {
        while (!cancelled) {
          await sleep(TIMEOUT);
          fetchDb();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoRefresh]);
  useEffect(() => {
    if (autoRefresh) {
      setNextFetchPercent(0);
      let cancelled = false;
      const interval = setInterval(() => {
        const now = Date.now();
        if (nextFetch > now && !cancelled) {
          setNextFetchPercent((1 - (nextFetch - now) / TIMEOUT) * 100);
        }
      }, TIMEOUT / 20);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
  }, [autoRefresh, nextFetch]);
  const countsByChain = useMemo(() => {
    const countsByChain: {
      [chain: string]: {
        empty: number;
        pending: number;
        missed: number;
        done: number;
      };
    } = {};
    Object.entries(db).forEach(([chain, vaasByBlock]) => {
      countsByChain[chain] = { empty: 0, pending: 0, missed: 0, done: 0 };
      Object.entries(vaasByBlock).forEach(([block, vaas]) => {
        if (vaas.length === 0) {
          countsByChain[chain].empty++;
        } else {
          countsByChain[chain].done++;
        }
      });
    });
    return countsByChain;
  }, [db]);
  return (
    <Box sx={{ m: { xs: 1, md: 2 } }}>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox value={showNumbers} onChange={handleToggleNumbers} />
          }
          label="Show Numbers"
        />
        <FormControlLabel
          control={
            <Checkbox value={autoRefresh} onChange={handleToggleAutoRefresh} />
          }
          label={
            <Box sx={{ display: "flex", alignItems: "center" }}>
              Auto-Refresh ({TIMEOUT / 1000}s)
              {autoRefresh || dbWrapper.isFetching ? (
                <CircularProgress
                  size={20}
                  variant={
                    dbWrapper.isFetching ? "indeterminate" : "determinate"
                  }
                  value={dbWrapper.isFetching ? undefined : nextFetchPercent}
                  sx={{ ml: 1 }}
                />
              ) : null}
            </Box>
          }
        />
      </FormGroup>
      {dbWrapper.lastFetched ? (
        <Typography variant="body2">
          Last retrieved at {dbWrapper.lastFetched}{" "}
          {dbWrapper.error ? (
            <Typography component="span" color="error" variant="body2">
              {dbWrapper.error}
            </Typography>
          ) : null}
        </Typography>
      ) : (
        <Typography variant="body2">Loading db...</Typography>
      )}
      {Object.entries(db).map(([chain, vaasByBlock]) => (
        <CollapsibleSection
          key={chain}
          header={
            <div>
              <Typography variant="h5" gutterBottom>
                {coalesceChainName(Number(chain) as ChainId)} ({chain})
              </Typography>
              <Typography
                component="div"
                sx={{
                  display: "flex",
                  alignItems: "center",
                }}
                gutterBottom
              >
                <Box sx={emptyBlockSx} />
                &nbsp;= {countsByChain[chain].empty}
                &nbsp;&nbsp;
                <Box sx={doneBlockSx} />
                &nbsp;= {countsByChain[chain].done}
              </Typography>
              <Typography variant="body2">
                Last Indexed Block{" "}
                {new Date(
                  Object.keys(vaasByBlock)[
                    Object.keys(vaasByBlock).length - 1
                  ].split("/")[1]
                ).toLocaleString()}
              </Typography>
            </div>
          }
        >
          <DetailBlocks
            chain={chain}
            vaasByBlock={vaasByBlock}
            showNumbers={showNumbers}
          />
        </CollapsibleSection>
      ))}
    </Box>
  );
}

export default App;
