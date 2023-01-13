import * as dotenv from 'dotenv';
dotenv.config();

import { initDb } from './databases/utils';
import {
  AptosWatcher,
  BSCWatcher,
  CosmwasmWatcher,
  EVMWatcher,
  MoonbeamWatcher,
  PolygonWatcher,
} from './watchers';
import { AlgorandWatcher } from './watchers/AlgorandWatcher';
import { ArbitrumWatcher } from './watchers/ArbitrumWatcher';
import { NearWatcher } from './watchers/NearWatcher';

initDb();

new EVMWatcher('ethereum', 'finalized').watch();
new BSCWatcher().watch();
new PolygonWatcher().watch();
new EVMWatcher('avalanche').watch();
new EVMWatcher('oasis').watch();
new AlgorandWatcher().watch();
new EVMWatcher('fantom').watch();
new EVMWatcher('karura', 'finalized').watch();
new EVMWatcher('acala', 'finalized').watch();
new EVMWatcher('klaytn').watch();
new EVMWatcher('celo').watch();
new MoonbeamWatcher().watch();
new ArbitrumWatcher().watch();
new AptosWatcher().watch();
new NearWatcher().watch();
new CosmwasmWatcher('terra2').watch();
new CosmwasmWatcher('terra').watch();
new CosmwasmWatcher('xpla').watch();
new CosmwasmWatcher('injective').watch();
