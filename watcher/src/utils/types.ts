import { EventLog, WormholePublishEventLog } from '../types/near';

export const isWormholePublishEventLog = (log: EventLog): log is WormholePublishEventLog => {
  return log.standard === 'wormhole' && log.event === 'publish';
};
