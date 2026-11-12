import { assert, assertEquals, assertRejects } from '@std/assert';
import {
  type DocumentByteStore,
  DocumentCodecError,
  readBytes,
} from '@kerebron/documents';
import {
  addAttachment,
  createAttachedForward,
  createForward,
  createReply,
  formatMailboxList,
  importMime,
  parseMailboxList,
  serializeMime,
} from '../src/mod.ts';

function byteStore(): DocumentByteStore {
  const bytes = new Map<string, Uint8Array>();
  return {
    async put(source) {
      const ref = crypto.randomUUID();
      bytes.set(ref, (await readBytes(source)).slice());
      return ref;
    },
    read(ref) {
      const value = bytes.get(ref);
      if (!value) throw new Error('Missing immutable source');
      return Promise.resolve(
        new ReadableStream({
          start(controller) {
            controller.enqueue(value.slice());
            controller.close();
          },
        }),
      );
    },
  };
}

Deno.test('nested fetched mail preserves bytes, CID, repeated headers and opaque attachments', async () => {
  const storage = byteStore();
  const bytes = await Deno.readFile(
    new URL('./fixtures/nested-related.eml', import.meta.url),
  );
  const document = await importMime(bytes, { storage });
  assertEquals(document.readOnly, false);
  assertEquals(document.subject, 'Synthetic record 😀');
  assert(document.body.html?.includes('cid:record-image@example.test'));
  assert(document.body.text?.includes('Café'));
  assertEquals(document.attachments.length, 3);
  assertEquals(document.attachments[0].cid, 'record-image@example.test');
  assertEquals(
    document.headers.filter((header) => header.name === 'X-Synthetic').length,
    2,
  );
  assertEquals(
    (await serializeMime(document, { storage, purpose: 'source' })).bytes,
    bytes,
  );
  document.body.text += '\nReviewed.';
  document.body.html += '<p>Reviewed.</p>';
  const output = await serializeMime(document, { storage, purpose: 'draft' });
  const reopened = await importMime(output.bytes, { storage });
  assert(reopened.body.text?.includes('Reviewed.'));
  assertEquals(
    reopened.headers.filter((header) => header.name === 'X-Synthetic').length,
    2,
  );
  assertEquals(
    reopened.attachments.map((part) => part.filename),
    document.attachments.map((part) => part.filename),
  );
  for (let i = 0; i < document.attachments.length; i++) {
    assertEquals(
      await readBytes(await storage.read(reopened.attachments[i].ref)),
      await readBytes(await storage.read(document.attachments[i].ref)),
    );
  }
  await assertRejects(
    () => serializeMime(document, { storage, purpose: 'source' }),
    DocumentCodecError,
    'unchanged',
  );
});

Deno.test('reply, new attachment, draft Bcc, delivery envelope, independent reopen', async () => {
  const storage = byteStore();
  const source = await importMime(
    await Deno.readFile(
      new URL('./fixtures/nested-related.eml', import.meta.url),
    ),
    { storage },
  );
  const reply = createReply(source, {
    sender: { address: 'user@example.test' },
    replyAll: true,
  });
  assertEquals(reply.to[0].address, 'sender@example.test');
  assertEquals(reply.cc.map((mailbox) => mailbox.address), [
    'colleague@example.test',
  ]);
  assertEquals(reply.bcc, []);
  reply.bcc = [{ address: 'private@example.test' }];
  reply.body = { text: 'Reviewed 😀', html: '<p>Reviewed 😀</p>' };
  await addAttachment(reply, new TextEncoder().encode('synthetic attachment'), {
    filename: 'vaccination 😀.txt',
    mediaType: 'text/plain',
  }, { storage });
  const draft = await serializeMime(reply, { storage, purpose: 'draft' });
  assertEquals(
    (await importMime(draft.bytes, { storage })).bcc[0].address,
    'private@example.test',
  );
  const delivery = await serializeMime(reply, { storage, purpose: 'delivery' });
  assertEquals(delivery.envelope, {
    from: 'user@example.test',
    to: [
      'sender@example.test',
      'colleague@example.test',
      'private@example.test',
    ],
  });
  assert(
    !new TextDecoder().decode(delivery.bytes).includes('private@example.test'),
  );
  const reopened = await importMime(delivery.bytes, { storage });
  assertEquals(reopened.subject, 'Re: Synthetic record 😀');
  assertEquals(reopened.inReplyTo, source.messageId);
  assertEquals(reopened.attachments[0].filename, 'vaccination 😀.txt');
  assert(reopened.body.html?.includes('Reviewed 😀'));
});

Deno.test('signed source stays read-only, retains source, and supports attached forwarding', async () => {
  const storage = byteStore();
  const bytes = new TextEncoder().encode(
    'From: sender@example.test\r\nTo: user@example.test\r\nSubject: Signed\r\nDKIM-Signature: synthetic\r\n\r\nOriginal body',
  );
  const source = await importMime(bytes, { storage });
  assert(source.readOnly);
  await assertRejects(
    () => serializeMime(source, { storage, purpose: 'draft' }),
    DocumentCodecError,
    'exported unchanged',
  );
  const forward = await createAttachedForward(source, {
    sender: { address: 'user@example.test' },
    storage,
  });
  forward.to = [{ address: 'other@example.test' }];
  const reopened = await importMime(
    (await serializeMime(forward, { storage, purpose: 'delivery' })).bytes,
    { storage },
  );
  assertEquals(reopened.attachments[0].mediaType, 'message/rfc822');
  assertEquals(
    await readBytes(await storage.read(reopened.attachments[0].ref)),
    bytes,
  );
});

Deno.test('declared invalid MIME never becomes MDY and storage failures stay failures', async () => {
  const storage = byteStore();
  const invalid = await importMime('not a mail header\n\njust text', {
    storage,
  });
  assert(invalid.readOnly);
  assertEquals(invalid.diagnostics[0].code, 'invalid-mime');
  assertEquals(
    new TextDecoder().decode(
      (await serializeMime(invalid, { storage, purpose: 'source' })).bytes,
    ),
    'not a mail header\n\njust text',
  );
  let puts = 0;
  const broken: DocumentByteStore = {
    ...storage,
    put: (...args) => {
      if (++puts > 1) throw new Error('encrypted write failed');
      return storage.put(...args);
    },
  };
  await assertRejects(
    () =>
      importMime(
        Deno.readFileSync(
          new URL('./fixtures/nested-related.eml', import.meta.url),
        ),
        { storage: broken },
      ),
    Error,
    'encrypted write failed',
  );
});

Deno.test('single-part messages, groups and header injection are handled at codec boundary', async () => {
  const storage = byteStore();
  const plain = await importMime(
    await Deno.readFile(
      new URL('./fixtures/plain-message.eml', import.meta.url),
    ),
    { storage },
  );
  assertEquals(plain.format, 'mime');
  assert(plain.body.text?.includes('still email'));
  const addresses = parseMailboxList(
    'Team: "Last, First" <first@example.test>, second@example.test;',
  );
  assertEquals(addresses.map((mailbox) => mailbox.address), [
    'first@example.test',
    'second@example.test',
  ]);
  assert(formatMailboxList(addresses).includes('"Last, First"'));
  plain.subject = 'Hello\r\nBcc: victim@example.test';
  await assertRejects(
    () => serializeMime(plain, { storage, purpose: 'delivery' }),
    DocumentCodecError,
    'line breaks',
  );
});

Deno.test('HTML-only reply and forward retain visible quoted content without loading or copying active markup', async () => {
  const storage = byteStore();
  const source = await importMime(
    'From: sender@example.test\r\nTo: user@example.test\r\nSubject: HTML only\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><head><style>hidden-style</style></head><body><p title="2 > 1">Caf&eacute; &amp; <b>review</b></p><p>Next<br>line</p><a href="javascript:active-code">Visible link</a><img src="https://example.test/never-fetch" alt="Record image"><script>hidden-script</script></body></html>',
    { storage },
  );
  assertEquals(source.body.text, undefined);
  for (
    const composed of [
      createReply(source, { sender: { address: 'user@example.test' } }),
      createForward(source, { sender: { address: 'user@example.test' } }),
    ]
  ) {
    assert(composed.body.text?.includes('Café & review'));
    assert(composed.body.text?.includes('Next'));
    assert(composed.body.text?.includes('line'));
    assert(composed.body.text?.includes('Visible link'));
    assert(composed.body.text?.includes('Record image'));
    assert(!composed.body.text?.includes('hidden-script'));
    assert(!composed.body.text?.includes('hidden-style'));
    assert(!composed.body.text?.includes('javascript:'));
    assert(!composed.body.text?.includes('never-fetch'));
    assertEquals(composed.body.html, undefined);
    composed.to = [{ address: 'recipient@example.test' }];
    const reopened = await importMime(
      (await serializeMime(composed, { storage, purpose: 'delivery' })).bytes,
      { storage },
    );
    assert(reopened.body.text?.includes('Café & review'));
    assert(reopened.body.text?.includes('Record image'));
  }
});
