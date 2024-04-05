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
