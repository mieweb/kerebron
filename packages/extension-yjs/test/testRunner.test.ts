import { runTests } from 'lib0/testing';

// import { DOMParser } from 'jsr:@b-fuze/deno-dom'; // No xml support (mathML) https://github.com/b-fuze/deno-dom/issues?q=is%3Aissue%20state%3Aopen%20xml
import { DOMParser, parseHTML } from 'npm:linkedom';

import { XMLSerializer } from 'npm:xmldom';
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const doc = new DOMParser().parseFromString(
  '<html><body></body></html>',
  'text/html',
)!;
// const doc = new DOMParser().parseFromString('<html><body></body></html>', "application/xhtml+xml")!;

globalThis.document = doc;

import * as yprosemirror from './y-prosemirror.test.ts';

Deno.test('testRepeatGenerateProsemirrorChanges2', async () => {
  await runTests({
    yprosemirror,
  });
});
