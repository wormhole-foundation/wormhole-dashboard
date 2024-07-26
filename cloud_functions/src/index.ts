import 'dotenv/config';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common/dist/utils';

// Improve performance by only loading the required module
module.exports = require(`./${assertEnvironmentVariable('FUNCTION')}`);
