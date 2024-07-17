import { Chain } from '@wormhole-foundation/sdk-base';
import { GuardianSetInfoByChain } from '@wormhole-foundation/wormhole-monitor-common';
import axios from 'axios';
import { useState, useEffect } from 'react';

const useGetGuardianSetInfoByChain = () => {
  const [guardianSetInfo, setGuardianSetInfo] = useState<GuardianSetInfoByChain>({});

  useEffect(() => {
    let cancelled = false;

    const fetchGuardianSetInfo = async () => {
      const info = await getCoreBridgeInfos();
      if (cancelled) return;
      setGuardianSetInfo(info);
    };

    fetchGuardianSetInfo();

    // Cleanup function to set the cancellation flag
    return () => {
      cancelled = true;
    };
  }, []);

  return guardianSetInfo;
};

async function getCoreBridgeInfos(): Promise<GuardianSetInfoByChain> {
  // This calls the getGuardianSetInfo cloud function
  // and returns the guardian set info for each chain
  const cloudFunctionUrl =
    'https://europe-west3-wormhole-message-db-mainnet.cloudfunctions.net/get-guardian-set-info';
  let infosByChain: GuardianSetInfoByChain = {};
  try {
    const response = await axios.post(cloudFunctionUrl);
    console.log('Response:', response.data);
    // Transform the response into a GuardianSetInfoByChain object
    for (const chain in response.data) {
      const data = response.data[chain];
      infosByChain[chain as Chain] = {
        timestamp: data.timestamp,
        contract: data.contract,
        guardianSet: data.guardianSet,
        guardianSetIndex: data.guardianSetIndex,
      };
    }
  } catch (error) {
    console.error('Error calling cloud function:', error);
  }
  return infosByChain;
}

export default useGetGuardianSetInfoByChain;
