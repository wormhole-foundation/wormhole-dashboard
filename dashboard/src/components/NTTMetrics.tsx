import { Divider } from '@mui/material';
import { NTTRateLimits } from './NTTRateLimits';
import { NTTTotalSupplyAndLocked } from './NTTTotalSupplyAndLocked';

function NTTMetrics() {
  return (
    <>
      <NTTRateLimits />
      <Divider />
      <NTTTotalSupplyAndLocked />
    </>
  );
}
export default NTTMetrics;
