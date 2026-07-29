import 'dotenv/config';
import { register } from 'module';
import { http } from '@google-cloud/functions-framework';
import { assertEnvironmentVariable } from '@wormhole-foundation/wormhole-monitor-common';

// Inject `type: 'json'` for JSON imports that some SDK ESM builds ship without
// the required import attribute. Must run before the function module is imported.
register('./jsonImportHook.js', import.meta.url);

// Improve performance by only loading the required module. Resolve the sibling
// function module against import.meta.url so it is imported at runtime rather
// than pulled into this module's static graph.
const functionName = assertEnvironmentVariable('FUNCTION');
const mod = (await import(new URL(`./${functionName}.js`, import.meta.url).href)) as Record<
  string,
  unknown
>;
const handler = mod[functionName];
if (typeof handler !== 'function') {
  throw new Error(`Function '${functionName}' is not exported by ./${functionName}.js`);
}
// Register declaratively so the functions-framework dispatches to it by name.
http(functionName, handler as Parameters<typeof http>[1]);
