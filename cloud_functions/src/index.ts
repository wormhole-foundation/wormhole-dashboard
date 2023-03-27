import dotenv from 'dotenv';
dotenv.config();
const functions = require('@google-cloud/functions-framework');
// need to export function modules to access with cloud functions
export const { getMessages } = require('./getMessages');
export const { getMessageCounts } = require('./getMessageCounts');
export const { getLatestBlocks } = require('./getLatestBlocks');
export const { getMissingVaas } = require('./getMissingVaas');
export const { computeMissingVaas } = require('./computeMissingVaas');
export const { computeMessageCounts } = require('./computeMessageCounts');
export const { getVaasByTxHash } = require('./getVaasByTxHash');
export const { processVaa } = require('./processVaa');

// Register an HTTP function with the Functions Framework that will be executed
// when you make an HTTP request to the deployed function's endpoint.
// below is for local testing in functions-framework
functions.http('messages', getMessages);
functions.http('messageCounts', getMessageCounts);
functions.http('computeMessageCounts', computeMessageCounts);
functions.http('latestBlocks', getLatestBlocks);
functions.http('missingVaas', getMissingVaas);
functions.http('computeMissingVaas', computeMissingVaas);
functions.http('getVaasByTxHash', getVaasByTxHash);
