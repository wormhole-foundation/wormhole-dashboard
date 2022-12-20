let loggingEnv: LoggingEnvironment | undefined = undefined;

export type LoggingEnvironment = {
  logLevel: string;
  logDir?: string;
};

export const getEnvironment = () => {
  if (loggingEnv) {
    return loggingEnv;
  } else {
    loggingEnv = {
      logLevel: assertEnvironmentVariable('LOG_LEVEL'),
    };
    // optional environment variables
    if (process.env.LOG_DIR) loggingEnv.logDir = process.env.LOG_DIR;
    return loggingEnv;
  }
};

export const assertEnvironmentVariable = (varName: string) => {
  if (varName in process.env) return process.env[varName]!;
  throw new Error(`Missing required environment variable: ${varName}`);
};
