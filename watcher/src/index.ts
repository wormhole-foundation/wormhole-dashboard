import * as dotenv from 'dotenv';
dotenv.config();

import { initDb } from './databases/utils';
import { BSCWatcher } from './watchers/BSCWatcher';
import { EVMWatcher } from './watchers/EVMWatcher';
import { MoonbeamWatcher } from './watchers/MoonbeamWatcher';
import { PolygonWatcher } from './watchers/PolygonWatcher';

initDb();

// new EVMWatcher('ethereum').watch();
new BSCWatcher().watch();
new PolygonWatcher().watch();
new EVMWatcher('avalanche').watch();
new EVMWatcher('oasis').watch();
new EVMWatcher('fantom').watch();
new EVMWatcher('karura').watch();
new EVMWatcher('acala').watch();
new EVMWatcher('klaytn').watch();
new EVMWatcher('celo').watch();
new MoonbeamWatcher().watch();
// new EVMWatcher('arbitrum').watch(); // TODO: requires waiting for l1 finality
