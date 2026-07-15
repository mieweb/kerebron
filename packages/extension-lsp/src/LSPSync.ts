import * as lsp from 'vscode-languageserver-protocol';

import { CoreEditor } from '@kerebron/editor';
import type {
  ContentMapper,
  Workspace,
  WorkspaceCloseParams,
  WorkspaceModifyParams,
} from '@kerebron/workspace';

import type { LspConfig } from './ExtensionLsp.ts';
import { LSPClient, LSPClientImpl } from './LSPClient.ts';

export class LSPSync {
  clients: Record<string, LSPClient> = {};

  uriToClient: Record<string, LSPClient> = {};
  uriToDiagnostics: Record<
    string,
    {
      diagnostics: lsp.Diagnostic[];
      version: number;
      contentMapper: ContentMapper;
    }
  > = {};

  listenerDiag: (
    event: CustomEvent<{ params: lsp.PublishDiagnosticsParams }>,
  ) => void;
  listenerDisconnect: (event: CustomEvent<void>) => void;
  listenerChange: (event: CustomEvent<WorkspaceModifyParams>) => Promise<void>;

  constructor(private config: LspConfig, private editor: CoreEditor) {
    this.listenerDiag = async (
      event: CustomEvent<{ params: lsp.PublishDiagnosticsParams }>,
    ) => {
      const { uri, diagnostics, version } = event.detail.params;

      const client = event.target as LSPClientImpl;

      const entry = client.entries[uri];
      if (!entry || !version) {
        return;
      }

      const contentMapper = await entry.getContentMapper();

      this.uriToDiagnostics[uri] = {
        diagnostics,
        version,
        contentMapper,
      };

      const tr = editor.state.tr;
      editor.dispatchTransaction(tr);
    };

    this.listenerDisconnect = (event: Event) => {
      const client = event.target as LSPClient;
      this.disconnected(client);
    };

    const workspace: Workspace = this.editor.ci.resolve('workspace');

    this.listenerChange = async (event: CustomEvent<WorkspaceModifyParams>) => {
      await this.changeFile(event.detail);
    };

    workspace.addEventListener('openFile', this.listenerChange);
    workspace.addEventListener('modifyFile', this.listenerChange);
    workspace.addEventListener(
      'closeFile',
      (event: CustomEvent<WorkspaceCloseParams>) => {
        this.closeFile(event.detail.uri);
      },
    );
  }

  async changeFile(modified: WorkspaceModifyParams) {
    const langClient = this.getClient(modified.lang);
    if (!langClient) {
      return;
    }

    const client: LSPClient | undefined = this.uriToClient[modified.uri];

    if (!client) {
      this.uriToClient[modified.uri] = langClient;
      await langClient.changeFile(modified);
      return;
    }

    if (client.lang !== langClient.lang) {
      await client.closeFile(modified.uri);
      this.uriToClient[modified.uri] = langClient;
      await langClient.changeFile(modified);
      return;
    }

    await client.changeFile(modified);
  }

  async closeFile(uri: string) {
    const client = this.uriToClient[uri];

    if (client) {
      delete this.uriToClient[uri];
      await client.closeFile(uri);
    }
  }

  disconnected(disconnectedClient: LSPClient): void {
    for (const [uri, client] of Object.entries(this.uriToClient)) {
      if (client !== disconnectedClient) {
        continue;
      }
      this.closeFile(uri);
    }
  }

  getClient(lang: string): LSPClient | undefined {
    if (!this.clients[lang]) {
      const transport = this.config.getLspTransport(lang);
      if (!transport) {
        console.warn(`No lsp transport for ${lang}`);
        return undefined;
      }
      const ui = this.editor.ui;

      const client: LSPClient = new LSPClientImpl(transport, {
        lang,
        rootUri: 'file:///',
        ui,
      });

      client.addEventListener(
        'textDocument/publishDiagnostics',
        this.listenerDiag,
      );
      client.addEventListener('close', this.listenerDisconnect);

      this.clients[lang] = client;
    }

    return this.clients[lang];
  }

  destroy() {
    const workspace: Workspace = this.editor.ci.resolve('workspace');

    workspace.removeEventListener('openFile', this.listenerChange);
    workspace.removeEventListener('modifyFile', this.listenerChange);

    for (const client of Object.values(this.clients)) {
      client.removeEventListener(
        'textDocument/publishDiagnostics',
        this.listenerDiag,
      );
      client.removeEventListener(
        'close',
        this.listenerDisconnect,
      );
      client.destroy();
    }
    this.clients = {};
    this.uriToClient = {};
    this.uriToDiagnostics = {};
  }
}
