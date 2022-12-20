import { createLogger, format, Logger, LoggerOptions, transports } from 'winston';
import { toArray } from './array';
import { getEnvironment } from './environment';

const { combine, errors, printf, simple, timestamp } = format;
let logger: WormholeLogger | undefined = undefined;

export type WormholeLogger = Logger & { labels: string[] };

// TODO: add support for custom log levels for scoped loggers
export const getLogger = (
  labels: string | string[] = [],
  parent?: WormholeLogger
): WormholeLogger => {
  // base logger is parent if unspecified
  if (!parent) parent = logger = logger ?? createBaseLogger();

  // no labels, return parent logger
  labels = toArray(labels);
  if (labels.length === 0) return parent;

  // create scoped logger
  const child: WormholeLogger = parent.child({
    labels: [...parent.labels, ...labels],
  }) as WormholeLogger;
  child.labels = labels;
  return child;
};

const createBaseLogger = (): WormholeLogger => {
  let { logLevel, logDir } = getEnvironment();
  logLevel = logLevel ?? 'debug';
  const logPath = !!logDir ? `${logDir}/watcher.${new Date().toISOString()}.log` : null;
  console.log(`watcher is logging to ${logPath ?? 'the console'} at level ${logLevel}`);

  const loggerConfig: LoggerOptions = {
    level: logLevel,
    format: combine(
      simple(),
      errors({ stack: true }),
      timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS ZZ',
      }),
      printf((info) => {
        // log format: [YYYY-MM-DD HH:mm:ss.SSS A ZZ] [level] [labels] message
        const labels = info.labels?.length > 0 ? info.labels.join(' | ') : 'main';
        return `[${info.timestamp}] [${info.level}] [${labels}] ${info.message}`;
      })
    ),
    transports: [
      logPath
        ? new transports.File({
            filename: logPath,
          })
        : new transports.Console(),
    ],
  };
  const logger = createLogger(loggerConfig) as WormholeLogger;
  logger.labels = [];
  return logger;
};
