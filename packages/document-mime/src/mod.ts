import PostalMime, { type Address, addressParser } from 'postal-mime';
import { createMimeMessage, Mailbox as MimeMailbox } from 'mimetext/browser';
// @deno-types="npm:@types/html-to-text@9.0.4"
import { compile as compileHtmlToText } from 'html-to-text';
import {
  type ByteSource,
  type CodecOptions,
  DEFAULT_MAX_BYTES,
  type DocumentAttachment,
  DocumentCodecError,
  type Mailbox,
  type MimeDocument,
  modelFingerprint,
  readBytes,
  type SerializedMessage,
} from '@kerebron/documents';

export type {
  DocumentAttachment,
  Mailbox,
  MimeDocument,
} from '@kerebron/documents';

export interface SerializeMimeOptions extends CodecOptions {
  purpose: 'source' | 'draft' | 'delivery';
  /** Host policy must affirm SMTPUTF8 when internationalized mailbox addresses occur. */
  allowSmtpUtf8?: boolean;
  sender?: Mailbox;
  date?: string;
  messageId?: string;
}

// This parser converts inert strings only: it neither mounts DOM nor fetches
// image/link URLs. The original HTML remains in the preserved source envelope.
const quotedHtmlToText = compileHtmlToText({
  wordwrap: false,
  selectors: [
    { selector: 'a', options: { ignoreHref: true } },
    { selector: 'img', options: { pathRewrite: () => '' } },
  ],
});

function quotedSourceText(source: MimeDocument): string {
  if (source.body.text?.trim()) return source.body.text;
  return source.body.html
    ? quotedHtmlToText(source.body.html)
    : source.body.text ?? '';
}

export function createMimeDocument(sender?: Mailbox): MimeDocument {
  return {
    format: 'mime',
    headers: [],
    from: sender ? [sender] : [],
    replyTo: [],
    to: [],
    cc: [],
    bcc: [],
    subject: '',
    body: { text: '' },
    attachments: [],
    readOnly: false,
    diagnostics: [],
  };
}

export function parseMailboxList(value: string): Mailbox[] {
  assertHeaderValue(value);
  const result = flattenAddresses(addressParser(value, { flatten: true }));
  for (const mailbox of result) validateMailbox(mailbox);
  return result;
}

export function formatMailboxList(mailboxes: Mailbox[]): string {
  return mailboxes.map((mailbox) => {
    validateMailbox(mailbox);
    return mailbox.name
      ? `"${
        mailbox.name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
      }" <${mailbox.address}>`
      : mailbox.address;
  }).join(', ');
}

function flattenAddresses(addresses: Address[] = []): Mailbox[] {
  return addresses.flatMap((entry) =>
    entry.group
      ? flattenAddresses(entry.group)
      : entry.address
      ? [{ address: entry.address, name: entry.name || undefined }]
      : []
  );
}

/** HTML remains untrusted. Rendering must sanitize and mediate CID/remote URLs. */
export async function importMime(
  source: ByteSource,
  options: CodecOptions,
): Promise<MimeDocument> {
  const bytes = await readBytes(source, options);
  const ref = await options.storage.put(bytes, {
    mediaType: 'message/rfc822',
    filename: 'source.eml',
  }, options);
  const document = createMimeDocument();
  document.source = { ref, size: bytes.byteLength };
  let email: Awaited<ReturnType<typeof PostalMime.parse>>;
  try {
    const prefix = new TextDecoder().decode(bytes.subarray(0, 8192));
    if (!/^[!-9;-~]+:/m.test(prefix.split(/\r?\n\r?\n/, 1)[0])) {
      throw new Error('A declared email source has no message headers.');
    }
    email = await PostalMime.parse(bytes, {
      forceRfc822Attachments: true,
      maxNestingDepth: 32,
      maxHeadersSize: 256 * 1024,
      maxPartCount: 1000,
      maxRfc822NestingDepth: 0,
    });
  } catch (error) {
    options.signal?.throwIfAborted();
    document.readOnly = true;
    document.diagnostics.push({
      code: 'invalid-mime',
      severity: 'error',
      message: error instanceof Error
        ? error.message
        : 'Unable to parse email source.',
    });
    document.importedFingerprint = mimeFingerprint(document);
    return document;
  }
  document.headers = email.headers.map((header) => ({
    name: header.originalKey,
    value: header.value,
  }));
  document.from = flattenAddresses(email.from ? [email.from] : []);
  document.replyTo = flattenAddresses(email.replyTo);
  document.to = flattenAddresses(email.to);
  document.cc = flattenAddresses(email.cc);
  document.bcc = flattenAddresses(email.bcc);
  document.subject = email.subject ?? '';
  document.date = email.date;
  document.messageId = email.messageId;
  document.inReplyTo = email.inReplyTo;
  document.references = email.references;
  document.body = { text: email.text, html: email.html };
  for (const [index, part] of email.attachments.entries()) {
    options.signal?.throwIfAborted();
    const content = typeof part.content === 'string'
      ? new TextEncoder().encode(part.content)
      : new Uint8Array(part.content);
    const filename = part.filename || `attachment-${index + 1}`;
    const attachmentRef = await options.storage.put(content, {
      mediaType: part.mimeType,
      filename,
    }, options);
    document.attachments.push({
      id: `part-${index + 1}`,
      ref: attachmentRef,
      filename,
      mediaType: part.mimeType,
      size: content.byteLength,
      disposition: part.disposition ??
        (part.related ? 'inline' : 'attachment'),
      cid: part.contentId?.replace(/^<|>$/g, ''),
    });
  }
  const contentType =
    email.headers.find((header) => header.key === 'content-type')?.value ?? '';
  if (
    /multipart\/(?:signed|encrypted)|application\/(?:x-)?pkcs7-mime/i.test(
      contentType,
    ) ||
    email.headers.some((header) =>
      /^(?:dkim-signature|arc-message-signature)$/.test(header.key)
    )
  ) {
    document.readOnly = true;
    document.diagnostics.push({
      code: 'signed-or-encrypted',
      severity: 'warning',
      message:
        'Signed or encrypted source is preserved read-only. Reply or forward creates a new message.',
    });
  }
  document.diagnostics.push({
    code: 'buffered-preview',
    severity: 'warning',
    message:
      'Preview codecs buffer messages within the configured size limit; arbitrary large-file streaming is not implemented.',
  });
  document.importedFingerprint = mimeFingerprint(document);
  return document;
}

export async function addAttachment(
  document: MimeDocument,
  source: ByteSource,
  metadata: { filename: string; mediaType: string; cid?: string },
  options: CodecOptions,
): Promise<DocumentAttachment> {
  if (document.readOnly) {
    throw new DocumentCodecError(
      'read-only',
      'Create a reply or forward before editing protected source.',
    );
  }
  const bytes = await readBytes(source, options);
  const ref = await options.storage.put(bytes, metadata, options);
  options.signal?.throwIfAborted();
  const attachment: DocumentAttachment = {
    id: crypto.randomUUID(),
    ref,
    size: bytes.byteLength,
    filename: metadata.filename,
    mediaType: metadata.mediaType,
    cid: metadata.cid,
    disposition: metadata.cid ? 'inline' : 'attachment',
  };
  document.attachments.push(attachment);
  return attachment;
}

export async function serializeMime(
  document: MimeDocument,
  options: SerializeMimeOptions,
): Promise<SerializedMessage> {
  options.signal?.throwIfAborted();
  if (options.purpose === 'source') {
    if (
      !document.source ||
      document.importedFingerprint !== mimeFingerprint(document)
    ) {
      throw new DocumentCodecError(
        'source-changed',
        'Original-source export is available only for an unchanged imported message. Save the edited draft instead.',
      );
    }
    return {
      bytes: await readBytes(
        await options.storage.read(document.source.ref, options),
        options,
      ),
      mediaType: 'message/rfc822',
    };
  }
  if (document.readOnly) {
    throw new DocumentCodecError(
      'read-only',
      'Signed, encrypted, or invalid source can only be exported unchanged.',
    );
  }
  const sender = options.sender ?? document.from[0];
  if (!sender || (!options.sender && document.from.length !== 1)) {
    throw new DocumentCodecError(
      'sender-required',
      'Choose exactly one authorized sender.',
    );
  }
  const recipients = [...document.to, ...document.cc, ...document.bcc];
  for (const mailbox of [sender, ...document.replyTo, ...recipients]) {
    validateMailbox(mailbox);
    if (
      !options.allowSmtpUtf8 &&
      [...mailbox.address].some((character) => character.codePointAt(0)! > 127)
    ) {
      throw new DocumentCodecError(
        'smtputf8-required',
        'Internationalized mailbox addresses require a host transport with SMTPUTF8.',
      );
    }
  }
  if (options.purpose === 'delivery' && recipients.length === 0) {
    throw new DocumentCodecError(
      'recipient-required',
      'Delivery requires at least one recipient.',
    );
  }
  const message = createMimeMessage();
  // Published MIMEText 3.0.24 drops text/plain when an inline part exists.
  // Reuse its alternative serializer in that case. No MIME syntax is emitted
  // here; remove this compatibility adapter after the upstream fix is released.
  const dumpTextContent = message.dumpTextContent;
  message.dumpTextContent = function (plain, html, boundary) {
    if (plain && html && this.hasInlineAttachments()) {
      const alternativeContext = Object.create(this) as typeof message;
      alternativeContext.hasInlineAttachments = () => false;
      alternativeContext.hasAttachments = () => true;
      return dumpTextContent.call(alternativeContext, plain, html, boundary);
    }
    return dumpTextContent.call(this, plain, html, boundary);
  };
  message.setSender({ addr: sender.address, name: sender.name ?? '' });
  if (document.replyTo.length > 1) {
    throw new DocumentCodecError(
      'unsupported-reply-to',
      'This preview supports one Reply-To mailbox; original source remains available.',
    );
  }
  if (document.replyTo[0]) {
    message.setHeader(
      'Reply-To',
      new MimeMailbox({
        addr: document.replyTo[0].address,
        name: document.replyTo[0].name ?? '',
      }),
    );
  }
  for (
    const [name, mailboxes] of [['To', document.to], ['Cc', document.cc], [
      'Bcc',
      options.purpose === 'draft' ? document.bcc : [],
    ]] as const
  ) {
    if (mailboxes.length) {
      message.setRecipients(
        mailboxes.map((mailbox) => ({
          addr: mailbox.address,
          name: mailbox.name ?? '',
        })),
        { type: name },
      );
    }
  }
  assertHeaderValue(document.subject);
  message.setSubject(document.subject);
  for (
    const [name, value] of [
      ['Date', options.date ?? document.date],
      ['Message-ID', options.messageId ?? document.messageId],
      ['In-Reply-To', document.inReplyTo],
      ['References', document.references],
    ]
  ) {
    if (value) {
      assertHeaderValue(value);
      message.setHeader(
        name!,
        name === 'Date' ? new Date(value).toUTCString() : value,
      );
    }
  }
  // Keep repeated extension/trace headers; content and edited fields are rebuilt.
  const rebuilt =
    /^(?:from|sender|reply-to|to|cc|bcc|subject|date|message-id|in-reply-to|references|mime-version|content-.+|dkim-signature|arc-.+)$/i;
  for (const header of document.headers) {
    if (rebuilt.test(header.name)) continue;
    if (!/^[!-9;-~]+$/.test(header.name)) {
      throw new DocumentCodecError(
        'invalid-header',
        'Invalid header field name.',
      );
    }
    assertHeaderValue(header.value);
    message.headers.setCustom({
      name: header.name,
      value: header.value,
      custom: true,
    });
  }
  const bodies =
    document.body.text === undefined && document.body.html === undefined
      ? { text: '' }
      : document.body;
  for (
    const [kind, body] of [['plain', bodies.text], [
      'html',
      bodies.html,
    ]] as const
  ) {
    if (body !== undefined) {
      message.addMessage({
        contentType: `text/${kind}`,
        encoding: 'base64',
        data: encodeBase64(new TextEncoder().encode(body)),
      });
    }
  }
  let totalBytes =
    new TextEncoder().encode(JSON.stringify(document.body)).byteLength;
  for (const attachment of document.attachments) {
    const bytes = await readBytes(
      await options.storage.read(attachment.ref, options),
      options,
    );
    totalBytes += bytes.byteLength;
    if (totalBytes > (options.maxBytes ?? DEFAULT_MAX_BYTES)) {
      throw new DocumentCodecError(
        'size-limit',
        'Decoded message exceeds preview size limit.',
      );
    }
    assertHeaderValue(attachment.filename);
    assertHeaderValue(attachment.mediaType);
    if (
      !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(attachment.mediaType)
    ) {
      throw new DocumentCodecError(
        'invalid-media-type',
        'Attachment media type must be a type/subtype token.',
      );
    }
    if (attachment.cid) assertHeaderValue(attachment.cid);
    const part = message.addAttachment({
      filename: 'attachment',
      contentType: attachment.mediaType,
      inline: attachment.disposition === 'inline',
      encoding: 'base64',
      data: encodeBase64(bytes),
      headers: attachment.cid ? { 'Content-ID': attachment.cid } : {},
    });
    const filename = encodeURIComponent(attachment.filename).replace(
      /[!'()*]/g,
      (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase(),
    );
    part.setHeader(
      'Content-Type',
      `${attachment.mediaType}; name*=UTF-8''${filename}`,
    );
    part.setHeader(
      'Content-Disposition',
      `${
        attachment.disposition === 'inline' ? 'inline' : 'attachment'
      }; filename*=UTF-8''${filename}`,
    );
    if (attachment.contentLocation) {
      assertHeaderValue(attachment.contentLocation);
      part.setHeader('Content-Location', attachment.contentLocation);
    }
  }
  const bytes = await readBytes(message.asRaw(), options);
  if (
    new TextDecoder().decode(bytes).split('\r\n').some((line) =>
      new TextEncoder().encode(line).byteLength > 998
    )
  ) {
    throw new DocumentCodecError(
      'header-or-line-too-long',
      'This preview cannot safely serialize a line exceeding the Internet message limit.',
    );
  }
  return {
    bytes,
    mediaType: 'message/rfc822',
    envelope: options.purpose === 'delivery'
      ? {
        from: sender.address,
        to: [...new Set(recipients.map((mailbox) => mailbox.address))],
      }
      : undefined,
  };
}

export function createReply(
  source: MimeDocument,
  options: { sender: Mailbox; replyAll?: boolean },
): MimeDocument {
  const result = createMimeDocument(options.sender);
  const self = options.sender.address.toLowerCase();
  result.to = (source.replyTo.length ? source.replyTo : source.from).filter((
    mailbox,
  ) => mailbox.address.toLowerCase() !== self);
  if (options.replyAll) {
    const seen = new Set([
      self,
      ...result.to.map((mailbox) => mailbox.address.toLowerCase()),
    ]);
    for (const mailbox of [...source.to, ...source.cc]) {
      const key = mailbox.address.toLowerCase();
      if (!seen.has(key)) {
        result.cc.push(mailbox);
        seen.add(key);
      }
    }
  }
  result.subject = /^re:/i.test(source.subject)
    ? source.subject
    : `Re: ${source.subject}`;
  result.inReplyTo = source.messageId;
  result.references =
    [source.references, source.messageId].filter(Boolean).join(' ') ||
    undefined;
  result.body.text = '\n\n' +
    quotedSourceText(source).split('\n').map((line) => '> ' + line).join('\n');
  return result;
}

/** Inline forwarding deliberately quotes text without automatically loading remote content. */
export function createForward(
  source: MimeDocument,
  options: { sender: Mailbox },
): MimeDocument {
  const result = createMimeDocument(options.sender);
  result.subject = /^fwd?:/i.test(source.subject)
    ? source.subject
    : `Fwd: ${source.subject}`;
  result.body.text = `\n\n---------- Forwarded message ----------\nFrom: ${
    formatMailboxList(source.from)
  }\nSubject: ${source.subject}\n\n${quotedSourceText(source)}`;
  result.attachments = structuredClone(source.attachments);
  return result;
}

export async function createAttachedForward(
  source: MimeDocument,
  options: CodecOptions & { sender: Mailbox },
): Promise<MimeDocument> {
  const result = createMimeDocument(options.sender);
  result.subject = `Fwd: ${source.subject}`;
  const original = await serializeMime(source, {
    ...options,
    purpose: 'source',
  });
  await addAttachment(result, original.bytes, {
    filename: 'forwarded-message.eml',
    mediaType: 'message/rfc822',
  }, options);
  return result;
}

function validateMailbox(mailbox: Mailbox): void {
  assertHeaderValue(mailbox.address);
  if (mailbox.name) assertHeaderValue(mailbox.name);
  if (
    !mailbox.address || !mailbox.address.includes('@') ||
    /[\s<>;,]/.test(mailbox.address)
  ) {
    throw new DocumentCodecError(
      'invalid-mailbox',
      'A mailbox must contain a valid address.',
    );
  }
}

function assertHeaderValue(value: string): void {
  if (value.includes('\r') || value.includes('\n') || value.includes('\0')) {
    throw new DocumentCodecError(
      'header-injection',
      'Header values cannot contain line breaks or NUL.',
    );
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary).match(/.{1,76}/g)?.join('\r\n') ?? '';
}

export function mimeFingerprint(document: MimeDocument): string {
  const {
    source: _source,
    importedFingerprint: _fingerprint,
    diagnostics: _diagnostics,
    ...content
  } = document;
  return modelFingerprint(content);
}
