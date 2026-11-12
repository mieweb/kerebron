/** The initial browser codec deliberately bounds its whole-message buffers. */
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export type ByteSource = string | Uint8Array | ReadableStream<Uint8Array>;

export interface ReadOptions {
  signal?: AbortSignal;
}

export interface StoredMediaMetadata {
  mediaType: string;
  filename?: string;
}

/** Host-owned storage; resolving put means its immutable bytes are durable. */
export interface DocumentByteStore {
  put(
    source: Uint8Array | ReadableStream<Uint8Array>,
    metadata: StoredMediaMetadata,
    options?: ReadOptions,
  ): Promise<string>;
  read(ref: string, options?: ReadOptions): Promise<ReadableStream<Uint8Array>>;
}

export interface CodecOptions extends ReadOptions {
  storage: DocumentByteStore;
  maxBytes?: number;
}

export interface CodecDiagnostic {
  code: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface Mailbox {
  address: string;
  name?: string;
}

export interface MessageHeader {
  name: string;
  value: string;
}

export interface DocumentAttachment {
  id: string;
  ref: string;
  filename: string;
  mediaType: string;
  size: number;
  disposition: string;
  cid?: string;
  contentLocation?: string;
}

export interface MimeDocument {
  format: 'mime';
  headers: MessageHeader[];
  from: Mailbox[];
  replyTo: Mailbox[];
  to: Mailbox[];
  cc: Mailbox[];
  bcc: Mailbox[];
  subject: string;
  date?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  body: { text?: string; html?: string };
  attachments: DocumentAttachment[];
  source?: { ref: string; size: number };
  /** A fingerprint of the imported normalized model, not an authorization token. */
  importedFingerprint?: string;
  readOnly: boolean;
  diagnostics: CodecDiagnostic[];
}

export interface MdyDocument {
  format: 'mdy';
  body: string;
  /** Exact opening/front-matter/closing bytes represented as UTF-8 text. */
  frontmatter: string;
  source?: { ref: string; size: number };
  importedFingerprint?: string;
  diagnostics: CodecDiagnostic[];
}

export type EditableDocument = MimeDocument | MdyDocument;

export interface MessageEnvelope {
  from: string;
  to: string[];
}

export interface SerializedMessage {
  bytes: Uint8Array;
  mediaType: string;
  envelope?: MessageEnvelope;
}

export class DocumentCodecError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DocumentCodecError';
  }
}
