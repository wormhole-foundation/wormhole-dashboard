import winston, { createLogger, format, Logger, LoggerOptions, transports } from 'winston';
import { toArray } from './array';
import { getEnvironment } from './environment';
import LokiTransport from 'winston-loki';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';

const { combine, errors, printf, simple, timestamp } = format;
let logger: WormholeLogger | undefined = undefined;

export type WormholeLogger = Logger & { source: string };

/**
 * Get a logger that is scoped to the given labels. If a parent logger is
 * provided, the parent's labels will be prepended to the given labels.
 * TODO: add support for custom log levels for scoped loggers
 *
 * Assuming `LOG_LEVEL=info`, the loggers below will output the following logs.
 * ```
 * getLogger().info(1); // base logger
 * const foo = getLogger('foo'); // implicitly uses base logger
 * foo.error(2)
 * getLogger('bar', foo).debug(3); // not logged because LOG_LEVEL=info
 * getLogger('bar', foo).warn(4);
 *
 * [2022-12-20 05:04:34.168 +0000] [info] [main] 1
 * [2022-12-20 05:04:34.170 +0000] [error] [foo] 2
 * [2022-12-20 05:04:34.170 +0000] [warn] [foo | bar] 4
 * ```
 * @param source
 * @returns
 */
export const getLogger = (source: string): WormholeLogger => {
  logger = logger ?? createBaseLogger();

  // no source, return main logger
  if (!source) return logger;

  // create scoped logger
  const child: WormholeLogger = logger.child({
    source: source,
  }) as WormholeLogger;
  child.source = source;
  logger.info({ message: `created child logger with label ${source}`, labels: { source: source } });
  return child;
};

const createBaseLogger = (): WormholeLogger => {
  const { logLevel, logDir, network } = getEnvironment();
  const logPath = !!logDir ? `${logDir}/watcher.${new Date().toISOString()}.log` : null;
  let transport: winston.transport[] = [
    logPath
      ? new transports.File({
          filename: logPath,
        })
      : new transports.Console(),
  ];
  let usingLoki = false;
  if (process.env.GRAFANA_HOST || process.env.GRAFANA_USERID || process.env.GRAFANA_PASSWORD) {
    usingLoki = true;
    const GRAFANA_HOST = assertEnvironmentVariable('GRAFANA_HOST');
    const GRAFANA_USERID = assertEnvironmentVariable('GRAFANA_USERID');
    const GRAFANA_PASSWORD = assertEnvironmentVariable('GRAFANA_PASSWORD');
    const MY_APP_NAME = network === '' ? 'wormhole-dashboard' : `wormhole-dashboard-${network}`;
    const GRAFANA_BASICAUTH = GRAFANA_USERID + ':' + GRAFANA_PASSWORD;
    transport.push(
      new LokiTransport({
        host: GRAFANA_HOST,
        labels: { product: MY_APP_NAME },
        json: true,
        basicAuth: GRAFANA_BASICAUTH,
        format: winston.format.json(),
        replaceTimestamp: false,
        onConnectionError: (err) => console.error(err),
      })
    );
  }
  console.log(
    `watcher is logging to ${logPath ?? 'the console'} ${
      usingLoki ? 'and loki' : ''
    } at level ${logLevel}`
  );

  const loggerConfig: LoggerOptions = {
    level: logLevel,
    format: combine(
      simple(),
      errors({ stack: true }),
      timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS ZZ',
      }),
      printf((info) => {
        // log format: [YYYY-MM-DD HH:mm:ss.SSS A ZZ] [level] [source] message
        const source = info.source || 'main';
        return `[${info.timestamp}] [${info.level}] [${source}] ${info.message}`;
      })
    ),
    transports: transport,
  };
  const logger = createLogger(loggerConfig) as WormholeLogger;
  return logger;
};
