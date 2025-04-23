import { Schema, type SchemaSpec } from 'prosemirror-model';

import { next as automerge } from '@automerge/automerge/slim';
import {
  DocHandle,
  isValidAutomergeUrl,
  Repo,
} from '@automerge/automerge-repo';

import { CoreEditor, Extension } from '@kerebron/editor';
import { NodeUnknown } from './NodeUnknown.ts';
import { MarkUnknown } from './MarkUnknown.ts';
import { NodeUnknownBlock } from './NodeUnknownBlock.ts';
import { addAmgNodeStateAttrs, SchemaAdapter } from './SchemaAdapter.ts';
import { SyncPlugin } from './SyncPlugin.ts';
import { CursorPlugin } from './CursorPlugin.ts';
import { pmDocToAmHandle } from './loader.ts';

const pathToTextField = ['text'];

export class ExtensionAutomerge extends Extension {
  name = 'automerge';

  requires = [new NodeUnknown(), new MarkUnknown(), new NodeUnknownBlock()];

  schemaSpec = {};
  repo: Repo;
  editor: CoreEditor;
  schemaAdapter: SchemaAdapter;
  syncPlugin: SyncPlugin<{ text: string }>;

  constructor(config) {
    super(config);

    this.repo = new Repo({
      storage: this.config.storage,
      // storage: new IndexedDBStorageAdapter("automerge"),
      network: [this.config.networkAdapter],
    });
  }

  override setupSpec(actualSpec: SchemaSpec) {
    addAmgNodeStateAttrs(actualSpec.nodes);
    this.schemaSpec = actualSpec;
  }

  loadFromAutoMerge(docUrl) {
    let handle: DocHandle<{ text: string }>;
    if (docUrl && isValidAutomergeUrl(docUrl)) {
      handle = this.repo.find(docUrl);
      this.syncPlugin.changeHandle(handle);
      //pmDocToAmHandle(this.schemaAdapter, handle, pmDoc);
      this.setupDebug(handle, this.editor);
      this.notifyNewUrl(handle.url);
    }
  }

  setupDebug<T>(handle: DocHandle<T>) {
    handle.on('change', (event) => {
      if (!handle.isReady()) {
        return;
      }
      const doc = handle.docSync();
      if (doc) {
        const event = new CustomEvent('automerge:change', {
          detail: {
            editor: this.editor,
            getSpans: () => automerge.spans(doc, pathToTextField),
            getMarks: () => automerge.marks(doc, pathToTextField),
          },
        });
        this.editor.dispatchEvent(event);
      }
    });
  }

  notifyNewUrl(url: string) {
    const event = new CustomEvent('automerge:url', {
      detail: {
        editor: this.editor,
        url,
      },
    });
    this.editor.dispatchEvent(event);
  }

  override getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    this.editor = editor;
    const schemaAdapter = new SchemaAdapter(schema);
    this.schemaAdapter = schemaAdapter;

    let handle: DocHandle<{ text: string }>;
    handle = this.repo.create({ text: '' });

    const syncPlugin = new SyncPlugin(schemaAdapter, pathToTextField, handle);
    this.syncPlugin = syncPlugin;

    editor.addEventListener('doc:loaded', (event: CustomEvent) => {
      const pmDoc = event.detail.doc;

      // const handle = this.repo.create({ text: '' });
      handle.whenReady()
        .then(() => {
          syncPlugin.changeHandle(handle);
          pmDocToAmHandle(schemaAdapter, handle, pmDoc);
          this.setupDebug(handle);
        });
    });

    handle.whenReady()
      .then(() => {
        this.notifyNewUrl(handle.url);

        const doc = handle.docSync();
        if (!doc) {
          throw new Error(
            'cannot initialize ProseMirror document when handle is not ready',
          );
        }
        this.setupDebug(handle);
      });

    return [
      syncPlugin,
      new CursorPlugin(),
    ];
  }
}
