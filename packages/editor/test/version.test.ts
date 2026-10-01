import { assertEquals } from '@kerebron/test-utils';

import { VERSION } from '@kerebron/editor';

Deno.test('VERSION falls back to dev without a build-time define', () => {
  assertEquals(VERSION, 'dev');
});
