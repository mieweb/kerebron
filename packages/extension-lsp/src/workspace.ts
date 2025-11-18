import type * as lsp from 'vscode-languageserver-protocol';
import { TextDocumentSyncKind } from 'vscode-languageserver-protocol';

import type { CoreEditor, EditorUi } from '@kerebron/editor';

import { LSPClient } from './LSPClient.ts';
import { ExtensionLsp } from './ExtensionLsp.ts';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';
import { computeIncrementalChanges } from './computeIncrementalChanges.ts';

export interface WorkspaceFile {
  uri: string;
  languageId: string;
  version: number;
  content: string;
  getEditor(main?: CoreEditor): CoreEditor | undefined;
  getUi(): EditorUi | undefined;
  mapper: PositionMapper;
}

interface WorkspaceFileUpdate {
  file: WorkspaceFile;
  prevDoc: string;
  changes: lsp.TextDocumentContentChangeEvent[];
}

export abstract class Workspace {
  abstract files: WorkspaceFile[];
  protected isConnected = false;

  constructor(
    readonly client: LSPClient,
  ) {}

  getFile(uri: string): WorkspaceFile | null {
    return this.files.find((f) => f.uri == uri) || null;
  }

  abstract syncFiles(): readonly WorkspaceFileUpdate[];

  requestFile(uri: string): Promise<WorkspaceFile | null> {
    return Promise.resolve(this.getFile(uri));
  }

  abstract openFile(uri: string, languageId: string, editor: CoreEditor): void;
  abstract changedFile(uri: string): void;
  abstract closeFile(uri: string): void;

  async connected(): Promise<void> {
    this.isConnected = true;
    for await (const file of this.files) {
      const result = await this.client.didOpen(file);
    }
  }

  disconnected(): void {
    for (const file of this.files) {
      this.client.workspace.closeFile(file.uri);
    }
    this.isConnected = false;
  }

  getUi(uri: string): Promise<EditorUi | undefined> {
    const file = this.getFile(uri);
    return Promise.resolve(file ? file.getUi() : undefined);
  }
}

class DefaultWorkspaceFile implements WorkspaceFile {
  public syncedContent: string = '';
  constructor(
    readonly uri: string,
    readonly languageId: string,
    public version: number,
    public content: string,
    public mapper: PositionMapper,
    readonly extensionLsp: ExtensionLsp,
  ) {
  }

  getEditor() {
    return this.extensionLsp.getEditor();
  }

  getUi() {
    return this.getEditor().ui;
  }
}

export class DefaultWorkspace extends Workspace {
  files: DefaultWorkspaceFile[] = [];
  private fileVersions: { [uri: string]: number } = Object.create(null);

  nextFileVersion(uri: string) {
    return this.fileVersions[uri] = (this.fileVersions[uri] ?? -1) + 1;
  }

  syncFiles() {
    if (!this.client.supportSync) {
      return [];
    }

    const result: WorkspaceFileUpdate[] = [];
    for (const file of this.files) {
      this.changedFile(file.uri);
    }

    return result;
  }

  async changedFile(uri: string) {
    const file = this.files.find((f) => f.uri == uri) || null;

    if (file) {
      const mappedContent = file.extensionLsp.getMappedContent();
      const { content, mapper } = mappedContent;

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
      }
    }
  }

  openFile(uri: string, languageId: string, editor: CoreEditor) {
    if (this.getFile(uri)) {
      this.closeFile(uri);
    }

    const extensionLsp: ExtensionLsp | undefined = editor.getExtension('lsp');
    if (!extensionLsp) {
      throw new Error(
        'No LSP extension',
      );
    }

    const mappedContent = extensionLsp.getMappedContent();
    const { content, mapper } = mappedContent;
    const file = new DefaultWorkspaceFile(
      uri,
      languageId,
      this.nextFileVersion(uri),
      content,
      mapper,
      extensionLsp,
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
