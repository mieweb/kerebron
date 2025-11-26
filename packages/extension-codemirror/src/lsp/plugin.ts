import type * as lsp from 'vscode-languageserver-protocol';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { Text } from '@codemirror/state';

import { type CoreEditor, RawTextResult } from '@kerebron/editor';
import type {
  ExtensionLsp,
  LSPClient,
  LspSource,
} from '@kerebron/extension-lsp';

import { fromPosition, toPosition } from './pos.ts';
import { escHTML } from './text.ts';
import { LSPExtension } from './index.ts';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';
import { toRawTextResult } from '@kerebron/editor/utilities';

export class LSPPlugin {
  readonly extensionLsp: ExtensionLsp;
  readonly uri: string;
  readonly editor: CoreEditor;
  readonly extension: LSPExtension;
  lang = 'plaintext';
  client?: LSPClient;
  source: LspSource;

  /// @internal
  constructor(
    /// The editor view that this plugin belongs to.
    readonly view: EditorView,
    { extension, extensionLsp, uri, editor }: {
      extension: LSPExtension;
      extensionLsp: ExtensionLsp;
      uri: string;
      editor: CoreEditor;
    },
  ) {
    this.extension = extension;
    this.extensionLsp = extensionLsp;
    this.uri = uri;
    this.editor = editor;

    this.source = {
      ui: this.editor.ui,
      getMappedContent: () => {
        const editor = this.editor;
        const result: RawTextResult = toRawTextResult(
          this.view.state.doc.toString().toString(),
          0,
        );
        const mapper = new PositionMapper(editor, result.rawTextMap);
        return {
          ...result,
          mapper,
        };
      },
    };
  }

  getClient() {
    return this.client;
  }

  setLang(lang: string) {
    this.lang = lang;

    const client = this.extensionLsp.getClient(lang);
    this.client = client;
    if (client) {
      client.disconnect(this.uri);
      client.connect(this.uri, this.source);
      client.workspace.openFile(
        this.uri,
        lang,
        this.source,
      );
    }
  }

  update() {
    if (this.client) {
      this.client.workspace.changedFile(
        this.uri,
      );
    }
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
