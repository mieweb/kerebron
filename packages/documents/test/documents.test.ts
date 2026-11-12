import { assertEquals, assertRejects } from '@std/assert';
import {
  createMdy,
  type DocumentByteStore,
  DocumentCodecError,
  importMdy,
  readBytes,
  selectDocumentFormat,
  serializeMdy,
} from '../src/mod.ts';

const stored = new Map<string, Uint8Array>();
const storage: DocumentByteStore = {
  async put(source) {
    const ref = crypto.randomUUID();
    stored.set(ref, (await readBytes(source)).slice());
    return ref;
  },
  read(ref) {
    return Promise.resolve(
      new ReadableStream({
        start(controller) {
          controller.enqueue(stored.get(ref)!);
          controller.close();
        },
      }),
    );
  },
};

Deno.test('MDY no-op bytes and raw YAML survive body edits and reopen', async () => {
  const source =
    '\uFEFF---\r\n# keep this comment\r\nunknown: "quoted: value"\r\nfield: mdy:example#id\r\n---\r\n# Synthetic note\r\nOriginal body.\r\n';
  const document = await importMdy(source, { storage });
  assertEquals(
    new TextDecoder('utf-8', { ignoreBOM: true }).decode(
      (await serializeMdy(document, { storage })).bytes,
    ),
    source,
  );
  document.body += '\r\nReviewed.';
  const reopened = await importMdy(
    (await serializeMdy(document, { storage })).bytes,
    { storage },
  );
  assertEquals(reopened.frontmatter, document.frontmatter);
  assertEquals(reopened.body, document.body);
  const ordinary = await importMdy('Body before\n---\nkey: value\n---\n', {
    storage,
  });
  assertEquals(ordinary.frontmatter, '');
});

Deno.test('non-email defaults to MDY; declared single-part or invalid email remains MIME', () => {
  assertEquals(selectDocumentFormat(), 'mdy');
  assertEquals(createMdy().format, 'mdy');
  assertEquals(
    selectDocumentFormat({ mode: 'email', prefix: 'No headers' }),
    'mime',
  );
  assertEquals(selectDocumentFormat({ mediaType: 'message/rfc822' }), 'mime');
  assertEquals(
    selectDocumentFormat({
      prefix: 'From: sender@example.test\r\nSubject: Hi\r\n\r\nBody',
    }),
    'mime',
  );
  assertEquals(selectDocumentFormat({ mediaType: 'text/x-mdy' }), 'mdy');
});

Deno.test('source cap aborts an oversize stream and cancels its producer', async () => {
  let cancelled = false;
  const source = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(8));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assertRejects(
    () => readBytes(source, { maxBytes: 10 }),
    DocumentCodecError,
    'at most 10',
  );
  assertEquals(cancelled, true);
  const abort = new AbortController();
  abort.abort();
  await assertRejects(
    () => readBytes(new Uint8Array(1), { signal: abort.signal }),
    DOMException,
  );
  await assertRejects(
    () => serializeMdy(createMdy('![image](blob:temporary)'), { storage }),
    DocumentCodecError,
    'durable',
  );
});
