import { NETWORK, assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';

let loggingEnv: LoggingEnvironment | undefined = undefined;

export type LoggingEnvironment = {
  logLevel: string;
  logDir?: string;
  network?: string;
};

export const getEnvironment = () => {
  if (loggingEnv) {
    return loggingEnv;
  } else {
    loggingEnv = {
      logLevel: process.env.LOG_LEVEL || 'info',
      logDir: process.env.LOG_DIR,
      network: process.env.NETWORK,
    };
    return loggingEnv;
  }
};

export function getNetworkFromEnv(): NETWORK {
  const networkEnv = assertEnvironmentVariable('NETWORK');
  if (networkEnv === 'mainnet') {
    return NETWORK.MAINNET;
  }
  if (networkEnv === 'testnet') {
    return NETWORK.TESTNET;
  }
  throw new Error(`Invalid network ${networkEnv}`);
}
