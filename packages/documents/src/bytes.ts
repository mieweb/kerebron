import {
  type ByteSource,
  DEFAULT_MAX_BYTES,
  DocumentCodecError,
  type ReadOptions,
} from './types.ts';

export async function readBytes(
  source: ByteSource,
  options: ReadOptions & { maxBytes?: number } = {},
): Promise<Uint8Array> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new DocumentCodecError(
      'invalid-limit',
      'maxBytes must be a positive integer.',
    );
  }
  options.signal?.throwIfAborted();
  const bytes = typeof source === 'string'
    ? new TextEncoder().encode(source)
    : source;
  if (bytes instanceof Uint8Array) {
    if (bytes.byteLength > maxBytes) throw tooLarge(maxBytes);
    return bytes;
  }
  const reader = bytes.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    void reader.cancel(options.signal?.reason).catch(() => {});
  };
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      options.signal?.throwIfAborted();
      const next = await reader.read();
      options.signal?.throwIfAborted();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel('message size limit exceeded');
        throw tooLarge(maxBytes);
      }
      chunks.push(next.value);
    }
  } finally {
    options.signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function tooLarge(maxBytes: number): DocumentCodecError {
  return new DocumentCodecError(
    'size-limit',
    `The preview codec supports at most ${maxBytes} bytes.`,
  );
}

/** Deterministic change detector; never used as a signature or security digest. */
export function modelFingerprint(value: unknown): string {
  return JSON.stringify(value);
}
