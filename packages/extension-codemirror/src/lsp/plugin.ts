import type * as lsp from 'vscode-languageserver-protocol';
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { ChangeSet, Extension, Text } from '@codemirror/state';
import { language } from '@codemirror/language';

import { type LSPClient } from '@kerebron/extension-lsp';

// import {docToHTML, withContext} from "./text"
import { fromPosition, toPosition } from './pos.ts';
import { escHTML } from './text.ts';
import { type CoreEditor } from '@kerebron/editor';
import { LSPExtension } from './index.ts';

/// A plugin that connects a given editor to a language server client.
export class LSPPlugin {
  readonly client: LSPClient;
  uri: string;
  readonly editor: CoreEditor;
  readonly extension: LSPExtension;

  /// @internal
  constructor(
    /// The editor view that this plugin belongs to.
    readonly view: EditorView,
    { extension, client, uri, editor }: {
      extension: LSPExtension;
      client: LSPClient;
      uri: string;
      editor: CoreEditor;
    },
  ) {
    this.extension = extension;
    this.client = client;
    this.uri = uri;
    this.editor = editor;

    this.syncedDoc = view.state.doc;
    this.unsyncedChanges = ChangeSet.empty(view.state.doc.length);
  }

  // /// Render a doc string from the server to HTML.
  // docToHTML(value: string | lsp.MarkupContent, defaultKind: lsp.MarkupKind = "plaintext") {
  //   let html = withContext(this.view, this.client.config.highlightLanguage, () => docToHTML(value, defaultKind))
  //   return this.client.config.sanitizeHTML ? this.client.config.sanitizeHTML(html) : html
  // }

  docToHTML(
    value: string | lsp.MarkupContent,
    defaultKind: lsp.MarkupKind = 'plaintext',
  ) {
    if ('string' === typeof value) {
      return escHTML(value);
    }

    return `docToHTML ${value.kind} ${JSON.stringify(value.value, null, 2)}`;
  }

  /// Convert a CodeMirror document offset into an LSP `{line,
  /// character}` object. Defaults to using the view's current
  /// document, but can be given another one.
  toPosition(pos: number, doc: Text = this.view.state.doc): lsp.Position {
    return toPosition(doc, pos);
  }

  /// Convert an LSP `{line, character}` object to a CodeMirror
  /// document offset.
  fromPosition(pos: lsp.Position, doc: Text = this.view.state.doc): number {
    return fromPosition(doc, pos);
  }

  /// Display an error in this plugin's editor.
  reportError(message: string, err: any) {
    this.editor.ui.showError(err);
  }

  /// The version of the document that was synchronized to the server.
  syncedDoc: Text;

  /// The changes accumulated in this editor that have not been sent
  /// to the server yet.
  unsyncedChanges: ChangeSet;

  /// Reset the [unsynced
  /// changes](#lsp-client.LSPPlugin.unsyncedChanges). Should probably
  /// only be called by a [workspace](#lsp-client.Workspace).
  clear() {
    this.syncedDoc = this.view.state.doc;
    this.unsyncedChanges = ChangeSet.empty(this.view.state.doc.length);
  }

  /// @internal
  update(update: ViewUpdate) {
    if (update.docChanged) {
      this.unsyncedChanges = this.unsyncedChanges.compose(update.changes);
    }
  }

  /// Get the LSP plugin associated with an editor, if any.
  static get(view: EditorView) {
    return view.plugin(lspPlugin);
  }
}

export const lspPlugin = ViewPlugin.fromClass(LSPPlugin);
