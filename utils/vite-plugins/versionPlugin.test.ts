import { assert, assertEquals } from '@std/assert';

import { versionPlugin } from './versionPlugin.ts';

Deno.test('versionPlugin defines __KEREBRON_VERSION__ as a string literal', () => {
  const config = (versionPlugin().config as () => {
    define: Record<string, string>;
  })();
  const version = JSON.parse(config.define.__KEREBRON_VERSION__);

  assertEquals(typeof version, 'string');
  assert(version.length > 0);
  assert(!version.startsWith('v'), `unexpected "v" prefix: ${version}`);
});
