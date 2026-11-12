# @kerebron/documents (experimental)

Headless generic document types and an MDY codec. Ordinary documents default to
MDY. Explicit/declared email remains MIME, including single-part messages.

Inject the host's `DocumentByteStore`; this package creates no storage session,
key service, document session, transport, or browser persistence. `put` must
return an immutable reference only after durable storage succeeds. In the
collaborative component this store is the protected Artipod adapter.

`importMdy` preserves the exact UTF-8 YAML envelope and source bytes.
`serializeMdy` keeps unknown YAML/comments/line endings on body edits. Explicit
metadata editing and a full MDY schema are later milestones; edit only `body`
for this preview. Blob/data media references are rejected on export. Hosts
resolve durable media references through their existing authorization service.

The preview has a configurable 10 MiB byte cap and whole-message buffers. This
does not satisfy the plan's large-file streaming or production memory gate.
