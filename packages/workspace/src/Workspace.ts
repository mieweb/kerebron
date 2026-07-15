import { ContentMapper } from './ContentMapper.ts';

export type WorkspaceFile = TextFile | BinaryFile;

export interface TextFile {
  uri: string;
  lang: string;
  version: number;
  getContentMapper: () => Promise<ContentMapper>;
}

export interface BinaryFile {
  uri: string;
}

interface WorkspaceRestartParams {
}

export interface WorkspaceOpenParams {
  uri: string;
  lang: string;
  version: number;
  getContentMapper: () => Promise<ContentMapper>;
}

export interface WorkspaceModifyParams {
  uri: string;
  lang: string;
  version: number;
  getContentMapper: () => Promise<ContentMapper>;
}

export interface WorkspaceCloseParams {
  uri: string;
}

export interface WorkspaceEventMap {
  restart: CustomEvent<WorkspaceRestartParams>;
  openFile: CustomEvent<WorkspaceOpenParams>;
  modifyFile: CustomEvent<WorkspaceModifyParams>;
  closeFile: CustomEvent<WorkspaceCloseParams>;
}

export interface Workspace extends EventTarget {
  addEventListener<K extends keyof WorkspaceEventMap>(
    type: K,
    listener: (event: WorkspaceEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;

  // fallback DOM signature (required)
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener<K extends keyof WorkspaceEventMap>(
    type: K,
    listener: (event: WorkspaceEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  // fallback DOM signature (required)
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;

  dispatchEvent<K extends keyof WorkspaceEventMap>(
    event: WorkspaceEventMap[K],
  ): boolean;
  dispatchEvent(event: Event): boolean;

  restart(): Promise<void>;
  getFiles(): string[];

  getFile(uri: string): TextFile | null;
  openFile(file: WorkspaceOpenParams): void;
  modifyFile(modification: WorkspaceModifyParams): void;
  closeFile(uri: string): void;
}

export class WorkspaceImpl extends EventTarget implements Workspace {
  files: Map<string, TextFile> = new Map();

  constructor() {
    super();
  }

  async restart(): Promise<void> {
    this.files.clear();
    this.dispatchEvent(new CustomEvent<WorkspaceRestartParams>('restart'));
  }

  getFiles(): string[] {
    return Array.from(this.files.keys());
  }

  getFile(uri: string): TextFile | null {
    return this.files.get(uri) || null;
  }

  openFile(file: WorkspaceOpenParams): void {
    this.files.set(file.uri, file);
    this.dispatchEvent(
      new CustomEvent<WorkspaceOpenParams>('openFile', {
        detail: file,
      }),
    );
  }

  modifyFile(modification: WorkspaceModifyParams): void {
    const file: TextFile = this.files.get(modification.uri) || modification;
    file.lang = modification.lang;
    file.version = modification.version;
    file.getContentMapper = modification.getContentMapper;
    this.files.set(modification.uri, file);

    this.dispatchEvent(
      new CustomEvent<WorkspaceModifyParams>('modifyFile', {
        detail: modification,
      }),
    );
  }

  closeFile(uri: string): void {
    this.dispatchEvent(
      new CustomEvent<WorkspaceCloseParams>('closeFile', {
        detail: {
          uri,
        },
      }),
    );
    this.files.delete(uri);
  }
}
