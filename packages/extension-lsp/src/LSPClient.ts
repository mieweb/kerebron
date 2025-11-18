import type * as lsp from 'vscode-languageserver-protocol';
import {
  MessageType,
  TextDocumentSyncKind,
} from 'vscode-languageserver-protocol';

import { DefaultWorkspace, Workspace, WorkspaceFile } from './workspace.ts';

const defaultNotificationHandlers: {
  [method: string]: (client: LSPClient, params: any) => void;
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
  'window/showMessage': (client, params: lsp.ShowMessageParams) => {
    if (params.type > MessageType.Info) return;
    for (const f of client.workspace.files) {
      const ui = f.getUi();
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
    diagnostic: {},
  },
  window: {
    showMessage: {},
  },
};

/// Configuration options that can be passed to the LSP client.
export type LSPClientConfig = {
  /// The project root URI passed to the server, when necessary.
  rootUri?: string;
  /// An optional function to create a
  /// [workspace](#lsp-client.Workspace) object for the client to use.
  /// When not given, this will default to a simple workspace that
  /// only opens files that have an active editor, and only allows one
  /// editor per file.
  workspace?: (client: LSPClient) => Workspace;
  /// The amount of milliseconds after which requests are
  /// automatically timed out. Defaults to 3000.
  timeout?: number;
  /// LSP servers can send Markdown code, which the client must render
  /// and display as HTML. Markdown can contain arbitrary HTML and is
  /// thus a potential channel for cross-site scripting attacks, if
  /// someone is able to compromise your LSP server or your connection
  /// to it. You can pass an HTML sanitizer here to strip out
  /// suspicious HTML structure.
  sanitizeHTML?: (html: string) => string;
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

export class LSPClient extends EventTarget {
  workspace: Workspace;
  private nextReqID = 0;
  private requests: Request<any>[] = [];

  serverCapabilities: lsp.ServerCapabilities | null = null;
  public supportSync: TextDocumentSyncKind = TextDocumentSyncKind.None;

  private readonly timeout: number;
  private initializing: ReturnType<typeof setInterval> | undefined;

  private readonly receiveListener: EventListenerOrEventListenerObject;
  active: boolean = false;

  constructor(
    private readonly transport: Transport,
    readonly config: LSPClientConfig = {},
  ) {
    super();

    this.timeout = config.timeout ?? 3000;

    this.receiveListener = (event) => this.receiveMessage(event);

    transport.addEventListener('message', this.receiveListener);
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
    transport.addEventListener('open', () => {
      this.startInitializing();
    });
    transport.addEventListener('close', (event) => {
      this.active = false;
      this.serverCapabilities = null;
      this.dispatchEvent(new CloseEvent('close'));
    });

    this.workspace = config.workspace
      ? config.workspace(this)
      : new DefaultWorkspace(this);
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
      } catch (ignoreConnectErrors) {
      }
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

  onInitialized() {
    this.transport.send(
      JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }),
    );

    this.workspace.connected();
  }

  disconnect() {
    this.active = false;
    this.serverCapabilities = null;
    this.transport.removeEventListener('data', this.receiveListener);
    this.workspace.disconnected();
    this.dispatchEvent(new CloseEvent('close'));
  }

  /// Send a `textDocument/didOpen` notification to the server.
  async didOpen(file: WorkspaceFile) {
    if (!this.transport.isInitialized()) {
      return false;
    }
    await this.notification<lsp.DidOpenTextDocumentParams>(
      'textDocument/didOpen',
      {
        textDocument: {
          uri: file.uri,
          languageId: file.languageId,
          text: file.content,
          version: file.version,
        },
      },
    );
    return true;
  }

  /// Send a `textDocument/didClose` notification to the server.
  didClose(uri: string) {
    if (!this.transport.isInitialized()) {
      return;
    }
    this.notification<lsp.DidCloseTextDocumentParams>('textDocument/didClose', {
      textDocument: { uri },
    });
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
            defaultNotificationHandlers[value.method](this, value.params);
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
    return this.serverCapabilities ? !!this.serverCapabilities[name] : null;
  }

  sync() {
    this.workspace.syncFiles();
  }

  private timeoutRequest<T>(
    req: Request<T>,
    method: string,
    id: number,
    params: any,
  ) {
    console.error('this.timeoutRequest', this.timeout, method, id, params);

    const index = this.requests.indexOf(req);
    if (index > -1) {
      req.reject(LSPError.createTimeout());
      this.requests.splice(index, 1);
    }
  }
}
