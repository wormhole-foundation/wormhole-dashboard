import { MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { useCallback } from "react";
import { networkOptions, useNetworkContext } from "../contexts/NetworkContext";

function NetworkSelector() {
  const { currentNetwork, setCurrentNetwork } = useNetworkContext();
  const handleChange = useCallback(
    (e: SelectChangeEvent) => {
      setCurrentNetwork(networkOptions[Number(e.target.value)]);
    },
    [setCurrentNetwork]
  );
  return (
    <Select
      onChange={handleChange}
      value={(networkOptions.indexOf(currentNetwork) || 0).toString()}
      margin="dense"
      size="small"
      sx={{ minWidth: 130 }}
      SelectDisplayProps={{
        style: { paddingTop: 4, paddingBottom: 4 },
      }}
    >
      {networkOptions.map((network, idx) => (
        <MenuItem key={network.endpoint} value={idx}>
          {network.logo !== "" ? (
            <img
              src={network.logo}
              alt={network.name}
              style={{ height: 20, maxHeight: 20, verticalAlign: "middle" }}
            />
          ) : (
            network.name
          )}
        </MenuItem>
      ))}
    </Select>
  );
}
export default NetworkSelector;
