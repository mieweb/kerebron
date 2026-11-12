# @kerebron/document-mime (experimental)

`importMime(rawSource, {storage})` accepts raw fetched email bytes or a readable
stream and returns headers, address fields, HTML/plain alternatives, CID
descriptors and attachments with immutable host storage references. HTML is
untrusted; the UI must sanitize it and mediate external/CID content before
rendering. No mail server or network client is included.

`createReply`, `createForward`, and `createAttachedForward` build editable new
messages. `addAttachment` publishes a descriptor only after storage resolves.
`parseMailboxList` and `formatMailboxList` avoid caller address parsing.
HTML-only messages receive a plain-text quote through `html-to-text` 9.0.5 (MIT),
preserving visible text, entities and image alt text without executing markup or
loading outside URLs. The original HTML remains in the protected source.

`serializeMime` requires an explicit purpose:

- `source`: byte-exact export of an unchanged original, including opaque parts.
- `draft`: rebuilt complete message retaining authorized Bcc.
- `delivery`: rebuilt complete message without Bcc headers; returns the SMTP
  envelope separately. The host owns sending and sender authorization.

PostalMime 4.0.5 (MIT-0) supplies MIME parsing. MIMEText 3.0.24's browser entry
(MIT) supplies writing. A narrow adapter reuses MIMEText's alternative writer
when inline parts exist: its published version otherwise drops text/plain;
fixture tests prove both alternatives and CID/opaque attachment bytes survive.
See the [PostalMime source](https://github.com/postalsys/postal-mime) and
[MIMEText source](https://github.com/muratgozel/MIMEText).

This is a bounded-buffer MVP, capped at 10 MiB by default, not a streaming MIME
implementation. Signed/encrypted sources remain read-only and exportable;
reply/forward creates new content. Nested MIME is flattened into presentation
alternatives and attachment descriptors; byte-exact structure is retained only
by unchanged source export. Editing regenerates a supported multipart structure.
Content-Location resolution, all imperfect-mail diagnostics, explicit MDY metadata
edits, long-header interoperability and arbitrary-large-file support remain
later gates. Multiple Reply-To mailboxes are rejected during rebuilt export;
internationalized mailbox addresses require explicit SMTPUTF8 host support.

Build all three additive preview packages with
`deno task build:documents 0.9.2-mvp.0`; these do not require upgrading existing
body-only Kerebron consumers.
