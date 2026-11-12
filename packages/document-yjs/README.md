# @kerebron/document-yjs (experimental)

An isolated borrowed-body EditorKit for existing Kerebron consumers (peer
`@kerebron/editor >=0.8.12`). Install one kit per editor view. The host owns the
Y.Doc, named/nested Y.XmlFragment, provider, initialization and persistence.

```ts
const kit = createBorrowedBodyKit({ doc, fragment, awareness });
// Include kit in editorKits. After editor onReady and authorized one-time import:
initializeFragment(fragment, initialProseMirrorNode); // once, host-controlled
kit.connect(editor);
// Serialize from a coherent host snapshot without mounting another editor:
const node = fragmentToProseMirror(snapshotFragment, editor.schema);
```

`connect` is idempotent and imports already-synced canonical state once. Empty
canonical bodies are never reseeded from view state. Kit/binding detach removes
its observers and undo manager without destroying host transport, Y.Doc or
shared awareness. `dispose` closes only this view's lease; a kit-created local
awareness instance is released. Per-view transaction origins prevent one view's
undo from undoing a sibling's edits. This MVP does not yet project remote cursor
decorations; awareness is borrowed without changing its local user state.

The implementation reuses Kerebron's existing Yjs binding/conversion modules;
it does not add a second DocumentSession or create a live provider.
