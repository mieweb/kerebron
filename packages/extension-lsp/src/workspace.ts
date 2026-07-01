import type { EditorUi } from '@kerebron/editor';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';

export interface LSPSource {
  ui: EditorUi;
  getMappedContent(): Promise<{ content: string; mapper: PositionMapper }>;
}

export interface WorkspaceFile {
  uri: string;
  languageId: string;
  version: number;
  content: string;
  source: LSPSource;
  getUi(): EditorUi | undefined;
  mapper: PositionMapper;
}

export abstract class Workspace extends EventTarget {
  abstract files: WorkspaceFile[];
  protected isConnected = false;

  constructor() {
    super();
  }

  getFile(uri: string): WorkspaceFile | null {
    return this.files.find((f) => f.uri == uri) || null;
  }

  abstract syncFiles(): void;

  requestFile(uri: string): Promise<WorkspaceFile | null> {
    return Promise.resolve(this.getFile(uri));
  }

  abstract openFile(uri: string, languageId: string, source: LSPSource): void;
  abstract changedFile(uri: string): void;
  abstract closeFile(uri: string): void;

  async connected(): Promise<void> {
    this.isConnected = true;
  }

  disconnected(): void {
    this.isConnected = false;
  }

  getUi(uri: string): Promise<EditorUi | undefined> {
    const file = this.getFile(uri);
    return Promise.resolve(file ? file.getUi() : undefined);
  }
}
