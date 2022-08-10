import { GetLastHeartbeatsResponse_Entry } from "@certusone/wormhole-sdk-proto-web/lib/cjs/publicrpc/v1/publicrpc";
import { useEffect, useState } from "react";
import { useNetworkContext } from "../contexts/NetworkContext";
import { getLastHeartbeats } from "../utils/getLastHeartbeats";

function useHeartbeats(): GetLastHeartbeatsResponse_Entry[] {
  const { currentNetwork } = useNetworkContext();
  const [heartbeats, setHeartbeats] = useState<
    GetLastHeartbeatsResponse_Entry[]
  >([]);
  useEffect(() => {
    setHeartbeats([]);
  }, [currentNetwork]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        const response = await getLastHeartbeats(currentNetwork);
        if (!cancelled) {
          setHeartbeats(
            response.entries.sort(
              (a, b) =>
                a.rawHeartbeat?.nodeName.localeCompare(
                  b.rawHeartbeat?.nodeName || ""
                ) || -1
            )
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNetwork]);
  return heartbeats;
}
export default useHeartbeats;
