import { modelFingerprint, readBytes } from './bytes.ts';
import {
  type ByteSource,
  type CodecOptions,
  DocumentCodecError,
  type MdyDocument,
  type SerializedMessage,
} from './types.ts';

/** Preserve the complete original YAML envelope when editing only Markdown. */
export async function importMdy(
  source: ByteSource,
  options: CodecOptions,
): Promise<MdyDocument> {
  const bytes = await readBytes(source, options);
  const ref = await options.storage.put(bytes, {
    mediaType: 'text/markdown; variant=mdy',
  }, options);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    throw new DocumentCodecError(
      'invalid-utf8',
      'MDY requires valid UTF-8 text.',
    );
  }
  const frontmatter = /^(?:\uFEFF)?---[ \t]*\r?\n/.test(text)
    ? text.match(/^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?^---[ \t]*(?:\r?\n|$)/m)
      ?.[0] ?? ''
    : '';
  const document: MdyDocument = {
    format: 'mdy',
    body: text.slice(frontmatter.length),
    frontmatter,
    source: { ref, size: bytes.byteLength },
    diagnostics: [],
  };
  document.importedFingerprint = mdyFingerprint(document);
  return document;
}

export function createMdy(body = ''): MdyDocument {
  return { format: 'mdy', body, frontmatter: '', diagnostics: [] };
}

export async function serializeMdy(
  document: MdyDocument,
  options: CodecOptions,
): Promise<SerializedMessage> {
  const unchanged = document.importedFingerprint === mdyFingerprint(document);
  const bytes = unchanged && document.source
    ? await readBytes(
      await options.storage.read(document.source.ref, options),
      options,
    )
    : await readBytes(document.frontmatter + document.body, options);
  // Local object URLs would become broken references after reopening.
  if (/\]\(\s*(?:blob:|data:)/i.test(document.body)) {
    throw new DocumentCodecError(
      'non-durable-media',
      'MDY media must use durable host-resolved references.',
    );
  }
  return { bytes, mediaType: 'text/markdown; variant=mdy' };
}

export function mdyFingerprint(document: MdyDocument): string {
  return modelFingerprint({
    body: document.body,
    frontmatter: document.frontmatter,
  });
}

export interface FormatSelection {
  format?: 'mime' | 'mdy';
  mode?: 'email' | 'document';
  mediaType?: string;
  /** A bounded prefix, never a complete source read for detection. */
  prefix?: string;
}

export function selectDocumentFormat(
  input: FormatSelection = {},
): 'mime' | 'mdy' {
  if (input.format) return input.format;
  if (input.mode === 'email') return 'mime';
  const mediaType = input.mediaType?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType === 'message/rfc822' || mediaType === 'message/global') {
    return 'mime';
  }
  if (mediaType === 'text/x-mdy' || mediaType === 'text/markdown') return 'mdy';
  if (input.mode === 'document') return 'mdy';
  const prefix = input.prefix?.slice(0, 8192) ?? '';
  if (
    /^(?:[!-9;-~]+:[^\r\n]*\r?\n)+/m.test(prefix) &&
    /^(?:from|to|subject|mime-version|content-type):/im.test(prefix)
  ) return 'mime';
  return 'mdy';
}
