import { type CoreEditor, type EditorKit, Extension } from '@kerebron/editor';
import type { Plugin } from 'prosemirror-state';
import type { Node, Schema } from 'prosemirror-model';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { ySyncPlugin } from '../../extension-yjs/src/ySyncPlugin.ts';
import {
  redoCommand,
  undoCommand,
  yUndoPlugin,
} from '../../extension-yjs/src/yUndoPlugin.ts';
import type { YjsProvider } from '../../extension-yjs/src/YjsProvider.ts';
import { ySyncPluginKey } from '../../extension-yjs/src/keys.ts';
import {
  prosemirrorToYXmlFragment,
  yXmlFragmentToProseMirrorRootNode,
} from '../../extension-yjs/src/binding/convertUtils.ts';

export interface BorrowedBodyOptions {
  doc: Y.Doc;
  fragment: Y.XmlFragment;
  awareness?: Awareness;
}

export interface BorrowedBodyKit extends EditorKit {
  /** Call after host import/initialization, once the editor is ready. */
  connect(editor: CoreEditor): void;
  /** Detaches this view; never destroys the host Y.Doc or transport. */
  dispose(): void;
}

/** The host initializes a canonical body once; joining views never seed it. */
export function initializeFragment(fragment: Y.XmlFragment, node: Node): void {
  if (!fragment.doc) {
    throw new Error('Initialize an attached canonical fragment.');
  }
  if (fragment.length !== 0) {
    throw new Error('Canonical fragment has already been initialized.');
  }
  prosemirrorToYXmlFragment(node, fragment);
}

export function fragmentToProseMirror(
  fragment: Y.XmlFragment,
  schema: Schema,
): Node {
  return yXmlFragmentToProseMirrorRootNode(fragment, schema);
}

export function createBorrowedBodyKit(
  options: BorrowedBodyOptions,
): BorrowedBodyKit {
  if (options.fragment.doc !== options.doc) {
    throw new Error('The fragment must belong to the host Y.Doc.');
  }
  const awareness = options.awareness ?? new Awareness(options.doc);
  const provider = Object.assign(new EventTarget(), {
    awareness,
    doc: options.doc,
    synced: true,
    destroy() {/* The host owns the shared transport and document. */},
  }) as YjsProvider;
  const origin = {};
  let attached: CoreEditor | undefined;
  let disposed = false;
  class BorrowedBodyExtension extends Extension {
    name = 'borrowed-document-body';
    override overrides = ['history'];
    override getProseMirrorPlugins(): Plugin[] {
      return [
        ySyncPlugin(this.editor, () => [provider, options.doc], {
          fragment: options.fragment,
          providerOwnership: 'borrowed',
          initializeFromEditor: false,
          origin,
        }),
        yUndoPlugin(),
      ];
    }
    override getCommandFactories() {
      return {
        undo: () => undoCommand,
        redo: () => redoCommand,
      };
    }
    override getKeyboardShortcuts() {
      return { 'Mod-z': 'undo', 'Mod-y': 'redo', 'Mod-Shift-z': 'redo' };
    }
  }
  const extension = new BorrowedBodyExtension();
  return {
    getExtensions: () => [extension],
    connect(editor) {
      if (disposed) throw new Error('Borrowed body kit is disposed.');
      if (attached && attached !== editor) {
        throw new Error('Create one borrowed body kit per view.');
      }
      if (attached === editor) return;
      attached = editor;
      // Reuse Kerebron's existing transaction protocol without importing room UI.
      if (!ySyncPluginKey.getState(editor.state)) {
        throw new Error('Install the borrowed body kit before connecting.');
      }
      editor.dispatchTransaction(
        editor.state.tr.setMeta(ySyncPluginKey, {
          changeRoom: { roomId: 'borrowed-body' },
        }),
      );
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (attached) {
        if (ySyncPluginKey.getState(attached.state)) {
          attached.dispatchTransaction(
            attached.state.tr.setMeta(ySyncPluginKey, { leaveRoom: true }),
          );
        }
        attached = undefined;
      }
      if (!options.awareness) awareness.destroy();
    },
  };
}
