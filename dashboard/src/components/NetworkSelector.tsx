import { MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { useCallback } from "react";
import { useNetworkContext } from "../contexts/NetworkContext";

function NetworkSelector() {
  const { currentNetwork, setCurrentNetwork } = useNetworkContext();
  const handleChange = useCallback(
    (e: SelectChangeEvent<"mainnet" | "testnet" | "devnet">) => {
      // TODO: what's the type deal here
      setCurrentNetwork(e.target.value as any);
    },
    [setCurrentNetwork]
  );
  return (
    <Select
      onChange={handleChange}
      value={currentNetwork}
      margin="dense"
      size="small"
    >
      <MenuItem value="mainnet">Mainnet</MenuItem>
      <MenuItem value="testnet">Testnet</MenuItem>
      <MenuItem value="devnet">Devnet</MenuItem>
    </Select>
  );
}
export default NetworkSelector;
