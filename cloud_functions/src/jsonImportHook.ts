// Node's native ESM loader requires an explicit `with { type: 'json' }` attribute
// on JSON imports. Some `@wormhole-foundation/sdk-*` ESM builds import their
// bundled anchor-idl `.json` files without that attribute, which makes the module
// graph fail to load with ERR_IMPORT_ATTRIBUTE_MISSING. This resolve hook injects
// the attribute for any `.json` target so those transitive imports resolve.
//
// Registered via `module.register()` in index.ts before the function module is
// dynamically imported, so it applies to the whole function graph.
export async function resolve(
  specifier: string,
  context: { importAttributes?: Record<string, string> },
  nextResolve: (
    s: string,
    c: unknown
  ) => Promise<{ url: string; importAttributes?: Record<string, string> }>
) {
  const result = await nextResolve(specifier, context);
  if (typeof result.url === 'string' && result.url.endsWith('.json')) {
    result.importAttributes = { ...(result.importAttributes ?? {}), type: 'json' };
  }
  return result;
}
