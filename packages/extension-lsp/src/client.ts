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

/// An object of this type should be used to wrap whatever transport
/// layer you use to talk to your language server. Messages should
/// contain only the JSON messages, no LSP headers.
export type Transport = {
  /// Send a message to the server. Should throw if the connection is
  /// broken somehow.
  send(message: string): void;
  /// Register a handler for messages coming from the server.
  subscribe(handler: (value: string) => void): void;
  /// Unregister a handler registered with `subscribe`.
  unsubscribe(handler: (value: string) => void): void;
};

class Request<Result> {
  declare resolve: (result: Result) => void;
  declare reject: (error: any) => void;
  promise: Promise<Result>;

  constructor(
    readonly id: number,
    readonly params: any,
    readonly timeout: number,
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

/// An LSP client manages a connection to a language server. It should
/// be explicitly [connected](#lsp-client.LSPClient.connect) before
/// use.
export class LSPClient extends EventTarget {
  /// @internal
  transport: Transport | null = null;
  /// The client's [workspace](#lsp-client.Workspace).
  workspace: Workspace;
  private nextReqID = 0;
  private requests: Request<any>[] = [];

  /// The capabilities advertised by the server. Will be null when not
  /// connected or initialized.
  serverCapabilities: lsp.ServerCapabilities | null = null;
  public supportSync: TextDocumentSyncKind = TextDocumentSyncKind.None;
  /// A promise that resolves once the client connection is initialized. Will be
  /// replaced by a new promise object when you call `disconnect`.
  initializing: Promise<null>;
  declare private init: {
    resolve: (value: null) => void;
    reject: (err: any) => void;
  };
  private timeout: number;

  /// Create a client object.
  constructor(
    /// @internal
    readonly config: LSPClientConfig = {},
  ) {
    super();
    this.receiveMessage = this.receiveMessage.bind(this);
    this.initializing = new Promise((resolve, reject) =>
      this.init = { resolve, reject }
    );
    this.timeout = config.timeout ?? 3000;
    this.workspace = config.workspace
      ? config.workspace(this)
      : new DefaultWorkspace(this);
  }

  /// Whether this client is connected (has a transport).
  get connected() {
    return !!this.transport;
  }

  /// Connect this client to a server over the given transport. Will
  /// immediately start the initialization exchange with the server,
  /// and resolve `this.initializing` (which it also returns) when
  /// successful.
  connect(transport: Transport) {
    if (this.transport) this.transport.unsubscribe(this.receiveMessage);
    this.transport = transport;
    transport.subscribe(this.receiveMessage);
    const capabilities = clientCapabilities;
    this.requestInner<lsp.InitializeParams, lsp.InitializeResult>(
      'initialize',
      {
        processId: null,
        clientInfo: { name: '@kerebron/lsp-client' },
        rootUri: this.config.rootUri || null,
        capabilities,
      },
    ).promise.then((resp) => {
      this.serverCapabilities = resp.capabilities;
      let sync = resp.capabilities.textDocumentSync;
      this.supportSync = TextDocumentSyncKind.None;
      if (sync) {
        this.supportSync = typeof sync == 'number'
          ? sync
          : sync.change ?? TextDocumentSyncKind.None;
      }
      transport.send(
        JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }),
      );
      this.init.resolve(null);
    }, this.init.reject);
    this.workspace.connected();
    return this;
  }

  /// Disconnect the client from the server.
  disconnect() {
    if (this.transport) this.transport.unsubscribe(this.receiveMessage);
    this.serverCapabilities = null;
    this.initializing = new Promise((resolve, reject) =>
      this.init = { resolve, reject }
    );
    this.workspace.disconnected();
  }

  /// Send a `textDocument/didOpen` notification to the server.
  didOpen(file: WorkspaceFile) {
    this.notification<lsp.DidOpenTextDocumentParams>('textDocument/didOpen', {
      textDocument: {
        uri: file.uri,
        languageId: file.languageId,
        text: file.content,
        version: file.version,
      },
    });
  }

  /// Send a `textDocument/didClose` notification to the server.
  didClose(uri: string) {
    this.notification<lsp.DidCloseTextDocumentParams>('textDocument/didClose', {
      textDocument: { uri },
    });
  }

  private receiveMessage(msg: string) {
    console.log(msg);

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
      this.transport!.send(JSON.stringify(resp));
    }
  }

  /// Make a request to the server. Returns a promise that resolves to
  /// the response or rejects with a failure message. You'll probably
  /// want to use types from the `vscode-languageserver-protocol`
  /// package for the type parameters.
  ///
  /// The caller is responsible for
  /// [synchronizing](#lsp-client.LSPClient.sync) state before the
  /// request and correctly handling state drift caused by local
  /// changes that happend during the request.
  request<Params, Result>(method: string, params: Params): Promise<Result> {
    if (!this.transport) {
      return Promise.reject(new Error('Client not connected'));
    }
    return this.initializing.then(() =>
      this.requestInner<Params, Result>(method, params).promise
    );
  }

  private requestInner<Params, Result>(
    method: string,
    params: Params,
    mapped = false,
  ): Request<Result> {
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
      setTimeout(() => this.timeoutRequest(req, id, params), this.timeout),
    );
    this.requests.push(req);
    try {
      this.transport!.send(JSON.stringify(data));
    } catch (e) {
      req.reject(e);
    }
    return req;
  }

  /// Send a notification to the server.
  notification<Params>(method: string, params: Params) {
    if (!this.transport) return;
    this.initializing.then(() => {
      let data: lsp.NotificationMessage = {
        jsonrpc: '2.0',
        method,
        params: params as any,
      };
      this.transport!.send(JSON.stringify(data));
    });
  }

  /// Cancel the in-progress request with the given parameter value
  /// (which is compared by identity).
  cancelRequest(params: any) {
    let found = this.requests.find((r) => r.params === params);
    if (found) this.notification('$/cancelRequest', found.id);
  }

  /// @internal
  hasCapability(name: keyof lsp.ServerCapabilities) {
    return this.serverCapabilities ? !!this.serverCapabilities[name] : null;
  }

  sync() {
    this.workspace.syncFiles();
  }

  private timeoutRequest<T>(req: Request<T>, id: number, params: any) {
    console.log('this.timeoutRequest', this.timeout, id, params);

    let index = this.requests.indexOf(req);
    if (index > -1) {
      req.reject(new Error('Request timed out'));
      this.requests.splice(index, 1);
    }
  }
}
