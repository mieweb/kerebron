import type * as lsp from 'vscode-languageserver-protocol';
import { TextDocumentSyncKind } from 'vscode-languageserver-protocol';

import type { EditorUi } from '@kerebron/editor';
import { Workspace, WorkspaceFile } from './workspace.ts';

import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';

import { LSPClient } from './LSPClient.ts';
import { computeIncrementalChanges } from './computeIncrementalChanges.ts';

export interface LSPSource {
  ui: EditorUi;
  getMappedContent(): Promise<{ content: string; mapper: PositionMapper }>;
}

class LSPWorkspaceFile implements WorkspaceFile {
  public syncedContent: string = '';
  public diagnostics: Array<lsp.Diagnostic> = [];

  constructor(
    readonly uri: string,
    readonly languageId: string,
    public version: number,
    public content: string,
    public mapper: PositionMapper,
    public source: LSPSource,
  ) {
  }

  getUi() {
    return this.source.ui;
  }
}

export class LSPWorkspace extends Workspace {
  files: LSPWorkspaceFile[] = [];
  private fileVersions: { [uri: string]: number } = Object.create(null);

  constructor(private client: LSPClient) {
    super();
  }

  nextFileVersion(uri: string) {
    return this.fileVersions[uri] = (this.fileVersions[uri] ?? -1) + 1;
  }

  override async connected(): Promise<void> {
    super.connected();
    for await (const file of this.files) {
      const result = await this.client.didOpen(file);
    }
  }

  override disconnected(): void {
    for (const file of this.files) {
      this.client.workspace.closeFile(file.uri);
    }
    super.disconnected();
  }

  syncFiles() {
    if (!this.client.supportSync) {
      return;
    }

    for (const file of this.files) {
      this.changedFile(file.uri);
    }
  }

  async changedFile(uri: string) {
    const file = this.files.find((f) => f.uri == uri) || null;

    if (file) {
      const { content, mapper } = await file.source.getMappedContent();

      if (!this.isConnected) {
        file.content = content;
        file.mapper = mapper;
        return;
      }

      if (
        await this.client.notification<lsp.DidChangeTextDocumentParams>(
          'textDocument/didChange',
          {
            textDocument: { uri: file.uri, version: file.version },
            contentChanges: contentChangesFor(
              file,
              content,
              mapper,
              this.client.supportSync == TextDocumentSyncKind.Incremental,
            ),
          },
        )
      ) {
        file.syncedContent = file.content;
        file.content = content;
        file.mapper = mapper;
        file.version = this.nextFileVersion(file.uri);
        file.diagnostics = [];

        this.dispatchEvent(
          new CustomEvent('fileChanged', { // TODO: clear diagnosrics
            detail: {
              uri: file.uri,
              file,
            },
          }),
        );
      }

      await this.client.notification<lsp.DocumentDiagnosticParams>(
        'textDocument/diagnostic',
        {
          textDocument: {
            uri: file.uri,
          },
        },
      );
    }
  }

  async openFile(uri: string, languageId: string, source: LSPSource) {
    // if (uri) {}

    if (this.getFile(uri)) {
      this.closeFile(uri);
    }

    const mappedContent = await source.getMappedContent();
    const { content, mapper } = mappedContent;
    const file = new LSPWorkspaceFile(
      uri,
      languageId,
      this.nextFileVersion(uri),
      content,
      mapper,
      source,
    );
    this.files.push(file);

    this.client.didOpen(file);
  }

  closeFile(uri: string) {
    const file = this.getFile(uri);
    if (file) {
      this.files = this.files.filter((f) => f.uri !== uri);
      this.client.didClose(uri);
    }
  }
}

const enum Sync {
  AlwaysIfSmaller = 1024,
}

function contentChangesFor(
  file: WorkspaceFile,
  newContent: string,
  mapper: PositionMapper,
  supportInc: boolean,
): lsp.TextDocumentContentChangeEvent[] {
  if (!supportInc || newContent.length < Sync.AlwaysIfSmaller) {
    return [{ text: newContent }];
  }

  const changes = computeIncrementalChanges(file.content, newContent);
  return changes.reverse();
}
