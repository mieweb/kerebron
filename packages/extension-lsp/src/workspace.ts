import type * as lsp from 'vscode-languageserver-protocol';
import { TextDocumentSyncKind } from 'vscode-languageserver-protocol';

import type { CoreEditor, EditorUi } from '@kerebron/editor';

import { LSPClient } from './client.ts';
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

  abstract closeFile(uri: string): void;

  connected(): void {
    for (const file of this.files) {
      this.client.didOpen(file);
    }
  }

  disconnected(): void {}

  // updateFile(uri: string, update: TransactionSpec): void {
  //   let file = this.getFile(uri);
  //   if (file) file.getEditor()?.dispatch(update);
  // }

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
    readonly mapper: PositionMapper,
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
      const mappedContent = file.extensionLsp.getMappedContent();
      const { content, mapper } = mappedContent;

      this.client.notification<lsp.DidChangeTextDocumentParams>(
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
      );

      file.syncedContent = file.content;
      file.content = content;
      file.mapper = mapper;
      file.version = this.nextFileVersion(file.uri);
    }

    return result;
  }

  openFile(uri: string, languageId: string, editor: CoreEditor) {
    if (this.getFile(uri)) {
      throw new Error(
        "Default workspace implementation doesn't support multiple views on the same file",
      );
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
      this.files = this.files.filter((f) => f != file);
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
  // if (changes.length > 0) {
  //   result.push({ changes, file, prevDoc: file.content });
  // }

  // let events: lsp.TextDocumentContentChangeEvent[] = [];
  // changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
  //   events.push({
  //     range: {
  //       start: toPosition(startDoc, fromA),
  //       end: toPosition(startDoc, toA),
  //     },
  //     text: inserted.toString(),
  //   });
  // });
  return changes.reverse();
}
