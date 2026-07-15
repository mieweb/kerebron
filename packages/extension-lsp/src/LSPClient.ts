import * as lsp from 'vscode-languageserver-protocol';
import {
  MessageType,
  TextDocumentSyncKind,
} from 'vscode-languageserver-protocol';

import { EditorUi } from '@kerebron/editor';
import type { ContentMapper, WorkspaceModifyParams } from '@kerebron/workspace';
import { contentChangesFor } from './computeIncrementalChanges.ts';

const defaultNotificationHandlers: {
  [method: string]: (
    client: LSPClient,
    params: any,
    config: LSPClientConfig,
  ) => void;
} = {
  'window/logMessage': (client, params: lsp.LogMessageParams) => {
    if (params.type == MessageType.Error) {
      console.error('[lsp] ' + params.message);
    } else if (params.type == MessageType.Warning) {
      console.warn('[lsp] ' + params.message);
    } else if (params.type == MessageType.Info) {
      console.info('[lsp] ' + params.message);
    } else if (params.type == MessageType.Log) {
      console.log('[lsp] ' + params.message);
    }
  },
  'window/showMessage': (
    client,
    params: lsp.ShowMessageParams,
    config: LSPClientConfig,
  ) => {
    if (params.type > MessageType.Info) return;
    for (const f of Object.entries(client.entries)) {
      const ui = config.ui;
      if (!ui) continue;
      ui.showMessage(params.message);
    }
  },
};

export type Transport = {
  connect(): void;
  disconnect(): void;
  send(message: string): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
  isConnected(): boolean;
  isInitialized(): boolean;
};

class Request<Result> {
  declare resolve: (result: Result) => void;
  declare reject: (error: any) => void;
  promise: Promise<Result>;

  constructor(
    readonly id: number,
    readonly params: any,
    readonly timeout: ReturnType<typeof setTimeout>,
  ) {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

const clientCapabilities: lsp.ClientCapabilities = {
  general: {
    markdown: {
      parser: 'marked',
    },
  },
  workspace: {
    'diagnostics': {
      'refreshSupport': true,
    },
  },
  textDocument: {
    publishDiagnostics: { versionSupport: true },
    completion: {
      completionItem: {
        snippetSupport: true,
        documentationFormat: ['plaintext', 'markdown'],
        insertReplaceSupport: false,
      },
      completionList: {
        itemDefaults: ['commitCharacters', 'editRange', 'insertTextFormat'],
      },
      completionItemKind: { valueSet: [] },
      contextSupport: true,
    },
    hover: {
      contentFormat: ['markdown', 'plaintext'],
    },
    // formatting: {},
    // rename: {},
    signatureHelp: {
      contextSupport: true,
      signatureInformation: {
        documentationFormat: ['markdown', 'plaintext'],
        parameterInformation: { labelOffsetSupport: true },
        activeParameterSupport: true,
      },
    },
    definition: {},
    declaration: {},
    implementation: {},
    typeDefinition: {},
    references: {},
    // diagnostic: {},
  },
  window: {
    showMessage: {},
  },
};

/// Configuration options that can be passed to the LSP client.
export type LSPClientConfig = {
  ui: EditorUi;
  lang: string;
  /// The project root URI passed to the server, when necessary.
  rootUri?: string;
  /// The amount of milliseconds after which requests are
  /// automatically timed out. Defaults to 3000.
  timeout?: number;
  /// LSP servers can send Markdown code, which the client must render
  /// and display as HTML. Markdown can contain arbitrary HTML and is
  /// thus a potential channel for cross-site scripting attacks, if
  /// someone is able to compromise your LSP server or your connection
  /// to it. You can pass an HTML sanitizer here to strip out
  /// suspicious HTML structure.
  // sanitizeHTML?: (html: string) => string;
  /// When no handler is found for a notification, it will be passed
  /// to this function, if given.
  unhandledNotification?: (
    client: LSPClient,
    method: string,
    params: any,
  ) => void;
};

export class LSPError extends Error {
  isTimeout = false;
  readonly isLSP = true;

  static createTimeout() {
    const err = new LSPError('Request timed out');
    err.isTimeout = true;
    return err;
  }
}

export interface LSPClientEventMap {
  'initialize': CustomEvent<lsp.InitializeParams>;
  'initialized': CustomEvent<lsp.InitializedParams>;
  'textDocument/didOpen': CustomEvent<lsp.DidOpenTextDocumentParams>;
  'textDocument/didChange': CustomEvent<lsp.DidChangeTextDocumentParams>;
  'textDocument/didClose': CustomEvent<lsp.DidCloseTextDocumentParams>;
  'textDocument/completion': CustomEvent<lsp.CompletionParams>;
  'textDocument/diagnostic': CustomEvent<lsp.DocumentDiagnosticParams>;
  'textDocument/publishDiagnostics': CustomEvent<
    { params: lsp.PublishDiagnosticsParams }
  >;
  'window/logMessage': CustomEvent<lsp.LogMessageParams>;
  'window/showMessage': CustomEvent<lsp.ShowMessageParams>;
  'close': CustomEvent<void>;
}

export interface LSPClient extends EventTarget {
  addEventListener<K extends keyof LSPClientEventMap>(
    type: K,
    listener: (event: LSPClientEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;

  // fallback DOM signature (required)
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener<K extends keyof LSPClientEventMap>(
    type: K,
    listener: (event: LSPClientEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  // fallback DOM signature (required)
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;

  dispatchEvent<K extends keyof LSPClientEventMap>(
    event: LSPClientEventMap[K],
  ): boolean;
  dispatchEvent(event: Event): boolean;

  lang: string;

  hasCapability(name: keyof lsp.ServerCapabilities): boolean;
  connect(): void;

  restart(): Promise<void>;
  changeFile(modified: WorkspaceModifyParams): Promise<boolean>;
  closeFile(uri: string): Promise<void>;

  request<Params, Result>(
    method: string,
    params: Params,
  ): Promise<Result>;
  notification<Params>(method: string, params: Params): Promise<boolean>;

  getEntry(uri: string): LSPEntry | undefined;

  destroy(): void;
}

interface LSPEntry {
  getContentMapper: () => Promise<ContentMapper>;
  uri: string;
  version: number;
  syncedText?: string;
  opened: boolean;
}

export class LSPClientImpl extends EventTarget implements LSPClient {
  entries: Record<string, LSPEntry> = {};

  // sources: Record<string, () => Promise<ContentMapper>> = {};
  // workspace: Workspace;
  private nextReqID = 0;
  private requests: Request<any>[] = [];

  serverCapabilities: lsp.ServerCapabilities | null = null;
  public supportSync: TextDocumentSyncKind = TextDocumentSyncKind.None;

  private readonly timeout: number;
  private initializing: ReturnType<typeof setInterval> | undefined;

  private readonly receiveListener: EventListenerOrEventListenerObject;
  private readonly startInitializingListener:
    EventListenerOrEventListenerObject;

  active: boolean = false;

  constructor(
    private readonly transport: Transport,
    readonly config: LSPClientConfig,
  ) {
    super();

    this.timeout = config.timeout ?? 3000;

    this.receiveListener = (event) => this.receiveMessage(event);
    this.startInitializingListener = (event) => this.startInitializing();

    transport.addEventListener('open', this.startInitializingListener);
    transport.addEventListener('initialized', () => {
      try {
        console.info('LSP initialized');
        this.onInitialized();
      } catch (err: any) {
        if (err.isLSP) {
          console.error(
            'Timeout as client.onConnected()',
            err.message,
            this.onInitialized,
          );
        } else {
          throw err;
        }
      }
    });
    transport.addEventListener('message', this.receiveListener);
    transport.addEventListener('close', (event) => {
      this.active = false;
      this.serverCapabilities = null;
      this.dispatchEvent(new CloseEvent('close'));
    });
  }

  destroy(): void {
    this.transport.removeEventListener('message', this.receiveListener);
    this.transport.removeEventListener('open', this.startInitializingListener);
  }

  get lang(): string {
    return this.config.lang;
  }

  startInitializing() {
    if (this.initializing) {
      return;
    }
    this.initializing = setInterval(async () => {
      const capabilities = clientCapabilities;

      try {
        const resp = await this.requestInner<
          lsp.InitializeParams,
          lsp.InitializeResult
        >(
          'initialize',
          {
            processId: null,
            clientInfo: { name: '@kerebron/lsp-client' },
            rootUri: this.config.rootUri || null,
            capabilities,
          },
        ).promise;

        this.stopInitializing();

        this.serverCapabilities = resp.capabilities;
        const sync = this.serverCapabilities.textDocumentSync;
        this.supportSync = TextDocumentSyncKind.None;
        if (sync) {
          this.supportSync = typeof sync == 'number'
            ? sync
            : sync.change ?? TextDocumentSyncKind.None;
        }
        // deno-lint-ignore no-empty
      } catch (ignoreConnectErrors) {}
    }, this.timeout);
  }

  stopInitializing() {
    if (this.initializing) {
      clearInterval(this.initializing);
      this.initializing = undefined;
    }
  }

  async restart() {
    this.active = true;
    if (!this.transport.isConnected()) {
      this.transport.connect();
    } else {
      this.startInitializing();
    }
  }

  async onInitialized() {
    this.transport.send(
      JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }),
    );

    for (const [uri, entry] of Object.entries(this.entries)) {
      if (entry.opened) {
        return;
      }

      await this.didOpen(entry);
    }

    this.dispatchEvent(new CustomEvent('initialized'));
  }

  connect() {
    this.active = true;
    if (!this.transport.isConnected()) {
      this.transport.connect();
    }
  }

  disconnect(uri: string) {
    if (Object.keys(this.entries).length === 0) {
      this.active = false;
      this.serverCapabilities = null;
      this.transport.removeEventListener('data', this.receiveListener);
      this.dispatchEvent(new CloseEvent('close'));
    }
  }

  async changeFile(modified: WorkspaceModifyParams): Promise<boolean> {
    const entry: LSPEntry = this.entries[modified.uri] || {
      uri: modified.uri,
      version: modified.version,
      syncedText: undefined,
      opened: false,
    };

    entry.version = modified.version;
    entry.getContentMapper = modified.getContentMapper;

    if (!this.entries[modified.uri]) {
      this.entries[modified.uri] = entry;
      return await this.didOpen(entry);
    } else {
      return await this.didChange(entry);
    }
  }

  /// Send a `textDocument/didOpen` notification to the server.
  async didOpen(entry: LSPEntry) {
    if (!this.transport.isInitialized()) {
      entry.opened = false;
      this.connect();
      return false;
    }

    const mapper = await entry.getContentMapper();
    const text = mapper.getTextContent();

    await this.notification<lsp.DidOpenTextDocumentParams>(
      'textDocument/didOpen',
      {
        textDocument: {
          uri: entry.uri,
          languageId: this.lang,
          text,
          version: entry.version,
        },
      },
    );

    entry.opened = true;
    entry.syncedText = text;

    await this.notification<lsp.DocumentDiagnosticParams>(
      'textDocument/diagnostic',
      {
        textDocument: {
          uri: entry.uri,
        },
      },
    );
    return true;
  }

  async didChange(entry: LSPEntry): Promise<boolean> {
    if (!this.transport.isInitialized()) {
      entry.opened = false;
      this.connect();
      return false;
    }

    if (!entry.opened) {
      return this.didOpen(entry);
    }

    const mapper = await entry.getContentMapper();
    const text = mapper.getTextContent();

    await this.notification<lsp.DidChangeTextDocumentParams>(
      'textDocument/didChange',
      {
        textDocument: { uri: entry.uri, version: entry.version },
        contentChanges: contentChangesFor(
          this.supportSync == lsp.TextDocumentSyncKind.Incremental,
          text,
          entry.syncedText,
        ),
      },
    );

    entry.syncedText = text;

    await this.notification<lsp.DocumentDiagnosticParams>(
      'textDocument/diagnostic',
      {
        textDocument: {
          uri: entry.uri,
        },
      },
    );
    return true;
  }

  async closeFile(uri: string): Promise<void> {
    delete this.entries[uri];
    if (!this.transport.isInitialized()) {
      return;
    }
    await this.notification<lsp.DidCloseTextDocumentParams>(
      'textDocument/didClose',
      {
        textDocument: { uri },
      },
    );
  }

  private receiveMessage(event: Event) {
    const msg = (event as MessageEvent).data;

    const value = JSON.parse(msg) as
      | lsp.ResponseMessage
      | lsp.NotificationMessage
      | lsp.RequestMessage;

    if ('id' in value && !('method' in value)) {
      const index = this.requests.findIndex((r) => r.id == value.id);
      if (index < 0) {
        console.warn(
          `[lsp] Received a response for non-existent request ${value.id}`,
        );
      } else {
        const req = this.requests[index];
        clearTimeout(req.timeout);
        this.requests.splice(index, 1);
        if (value.error) req.reject(value.error);
        else req.resolve(value.result);
      }
    } else if (!('id' in value)) {
      const event = new CustomEvent(value.method, {
        detail: { params: value.params },
      });
      if (this.dispatchEvent(event)) {
        if (this.config.unhandledNotification) {
          this.config.unhandledNotification(this, value.method, value.params);
        } else {
          if (defaultNotificationHandlers[value.method]) {
            defaultNotificationHandlers[value.method](
              this,
              value.params,
              this.config,
            );
          }
        }
      }
    } else {
      const resp: lsp.ResponseMessage = {
        jsonrpc: '2.0',
        id: value.id,
        error: {
          code: -32601, /* MethodNotFound */
          message: 'Method not implemented',
        },
      };
      this.transport.send(JSON.stringify(resp));
    }
  }

  async request<Params, Result>(
    method: string,
    params: Params,
  ): Promise<Result> {
    if (!this.transport.isConnected()) {
      if (this.active) {
        this.transport.connect();
      }
      throw new LSPError('Not connected');
    }

    const retVal = await this.requestInner<Params, Result>(method, params)
      .promise;
    return retVal;
  }

  private requestInner<Params, Result>(
    method: string,
    params: Params,
    mapped = false,
  ): Request<Result> {
    if (!this.transport) {
      throw new Error('No transport');
    }
    if (!this.transport.isConnected()) {
      if (this.active) {
        this.transport.connect();
      }
      throw new Error('Transport not connected');
    }

    const id = ++this.nextReqID,
      data: lsp.RequestMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params: params as any,
      };

    const req = new Request<Result>(
      id,
      params,
      setTimeout(
        () => this.timeoutRequest(req, method, id, params),
        this.timeout,
      ),
    );

    try {
      if (!this.transport) {
        throw new LSPError('No transport');
      }
      this.transport.send(JSON.stringify(data));
      this.requests.push(req);
    } catch (e) {
      console.error(e);
      clearTimeout(req.timeout);
      req.reject(e);
    }
    return req;
  }

  async notification<Params>(method: string, params: Params): Promise<boolean> {
    if (!this.transport) return false;
    if (!this.transport.isConnected()) {
      if (this.active) {
        this.transport.connect();
      }
      return false;
    }
    if (!this.transport.isInitialized()) {
      return false;
    }
    const data: lsp.NotificationMessage = {
      jsonrpc: '2.0',
      method,
      params: params as any,
    };
    this.transport.send(JSON.stringify(data));
    return true;
  }

  cancelRequest(params: any) {
    const found = this.requests.find((r) => r.params === params);
    if (found) {
      this.notification('$/cancelRequest', found.id);
    }
  }

  hasCapability(name: keyof lsp.ServerCapabilities) {
    return this.serverCapabilities ? !!this.serverCapabilities[name] : false;
  }

  private timeoutRequest<T>(
    req: Request<T>,
    method: string,
    id: number,
    params: any,
  ) {
    const index = this.requests.indexOf(req);
    if (index > -1) {
      req.reject(LSPError.createTimeout());
      this.requests.splice(index, 1);
    }
  }

  getEntry(uri: string): LSPEntry | undefined {
    return this.entries[uri];
  }
}
