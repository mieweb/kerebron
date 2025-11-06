import type { CoreEditor, EditorUi } from '@kerebron/editor';

import { LSPClient } from './client.ts';

export interface WorkspaceFile {
  uri: string;
  languageId: string;
  version: number;
  content: string;
  getEditor(main?: CoreEditor): CoreEditor | undefined;
  getUi(): EditorUi | undefined;
}

interface WorkspaceFileUpdate {
  file: WorkspaceFile;
  prevDoc: string;
  // changes: ChangeSet;
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
  constructor(
    readonly uri: string,
    readonly languageId: string,
    public version: number,
    public content: string,
    readonly editor: CoreEditor,
  ) {}

  getEditor() {
    return this.editor;
  }

  getUi() {
    return this.editor.ui;
  }
}

export class DefaultWorkspace extends Workspace {
  files: DefaultWorkspaceFile[] = [];
  private fileVersions: { [uri: string]: number } = Object.create(null);

  nextFileVersion(uri: string) {
    return this.fileVersions[uri] = (this.fileVersions[uri] ?? -1) + 1;
  }

  syncFiles() {
    const result: WorkspaceFileUpdate[] = [];
    for (const file of this.files) {
      //   let plugin = LSPPlugin.get(file.view);
      //   if (!plugin) continue;
      //   let changes = plugin.unsyncedChanges;
      //   if (!changes.empty) {
      //     result.push({ changes, file, prevDoc: file.doc });
      //     file.doc = file.view.state.doc;
      //     file.version = this.nextFileVersion(file.uri);
      //     plugin.clear();
      //   }
    }
    return result;
  }

  openFile(uri: string, languageId: string, editor: CoreEditor) {
    if (this.getFile(uri)) {
      throw new Error(
        "Default workspace implementation doesn't support multiple views on the same file",
      );
    }
    const content = 'TODO';
    const file = new DefaultWorkspaceFile(
      uri,
      languageId,
      this.nextFileVersion(uri),
      content,
      editor,
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
