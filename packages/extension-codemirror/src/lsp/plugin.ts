import type * as lsp from 'vscode-languageserver-protocol';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { Text } from '@codemirror/state';

import { type LSPClient } from '@kerebron/extension-lsp';

import { fromPosition, toPosition } from './pos.ts';
import { escHTML } from './text.ts';
import { type CoreEditor } from '@kerebron/editor';
import { LSPExtension } from './index.ts';

export class LSPPlugin {
  readonly client: LSPClient;
  readonly uri: string;
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

  /// Get the LSP plugin associated with an editor, if any.
  static get(view: EditorView) {
    return view.plugin(lspPlugin);
  }
}

export const lspPlugin = ViewPlugin.fromClass(LSPPlugin);
