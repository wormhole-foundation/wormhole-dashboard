import dotenv from 'dotenv';
dotenv.config();
const functions = require('@google-cloud/functions-framework');
// need to export function modules to access with cloud functions
export const { getMessages } = require('./getMessages');
export const { getMessageCounts } = require('./getMessageCounts');
export const { getLatestBlocks } = require('./getLatestBlocks');
export const { getLatestTvlTvm } = require('./getLatestTvlTvm');
export const { getMissingVaas } = require('./getMissingVaas');
export const { alarmMissingVaas } = require('./alarmMissingVaas');
export const { computeMissingVaas } = require('./computeMissingVaas');
export const { computeMessageCounts } = require('./computeMessageCounts');
export const { getVaasByTxHash } = require('./getVaasByTxHash');
export const { processVaa } = require('./processVaa');
export const { refreshTodaysTokenPrices } = require('./refreshTodaysTokenPrices');
export const { computeTVL } = require('./computeTVL');
export const { getTVL } = require('./getTVL');
export const { computeTVLHistory } = require('./computeTVLHistory');
export const { getTVLHistory } = require('./getTVLHistory');
export const { getMessageCountHistory } = require('./getMessageCountHistory');
export const { computeMessageCountHistory } = require('./computeMessageCountHistory');
export const { computeTvlTvm } = require('./computeTvlTvm');

// Register an HTTP function with the Functions Framework that will be executed
// when you make an HTTP request to the deployed function's endpoint.
// below is for local testing in functions-framework
functions.http('messages', getMessages);
functions.http('messageCounts', getMessageCounts);
functions.http('computeMessageCounts', computeMessageCounts);
functions.http('latestBlocks', getLatestBlocks);
functions.http('latestTvlTvm', getLatestTvlTvm);
functions.http('missingVaas', getMissingVaas);
functions.http('alarmMissingVaas', alarmMissingVaas);
functions.http('computeMissingVaas', computeMissingVaas);
functions.http('getVaasByTxHash', getVaasByTxHash);
functions.http('refreshTodaysTokenPrices', refreshTodaysTokenPrices);
functions.http('computeTVL', computeTVL);
functions.http('getTVL', getTVL);
functions.http('computeTVLHistory', computeTVLHistory);
functions.http('getTVLHistory', getTVLHistory);
functions.http('getMessageCountHistory', getMessageCountHistory);
functions.http('computeMessageCountHistory', computeMessageCountHistory);
functions.http('computeTvlTvm', computeTvlTvm);
