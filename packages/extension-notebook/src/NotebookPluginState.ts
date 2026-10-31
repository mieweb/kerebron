import { Transaction } from 'prosemirror-state';

import { JupyterWebSocketTransport } from './JupyterWebSocketTransport.ts';
import { JupyterClient } from './JupyterClient.ts';
import { CodeCellNodeView } from './NodeViewCodeCell.ts';

export interface NotebookMeta {
  nodeView: CodeCellNodeView;
  eval?: {
    code: string;
  };
  execute?: {
    code: string;
  };
  start?: boolean;
  shutdown?: boolean;
}

export class NotebookPluginState {
  transport: JupyterWebSocketTransport;
  client: JupyterClient;

  constructor() {
    this.transport = new JupyterWebSocketTransport('/jupyter');
    this.transport.connect();

    this.client = new JupyterClient(this.transport);
  }

  handleCommands(pluginMeta: NotebookMeta | undefined, tr: Transaction) {
    if (!pluginMeta) {
      return false;
    }

    if (pluginMeta.start) {
      this.client.request({
        op: 'start',
      });
      return true;
    }

    if (pluginMeta.shutdown) {
      this.client.request({
        op: 'shutdown',
      });
      return true;
    }

    if (pluginMeta.execute) {
      this.client.request({
        op: 'execute',
        code: pluginMeta.execute.code,
      }).then((result) => {
        console.log('exeku', result);
        pluginMeta.nodeView.setResult(result);
      });
      return true;
    }

    if (pluginMeta.eval) {
      this.client.request({
        op: 'eval',
        code: pluginMeta.eval.code,
      });
      return true;
    }

    return true;
  }

  destroy() {
    this.client.destroy();
    this.transport.disconnect();
  }
}
