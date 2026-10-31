import type { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';

import { JupyterWsAdapter } from '../jupyter/jupyter-server.ts';

const jupyterWsAdapter = new JupyterWsAdapter();

export function install(
  { app, upgradeWebSocket }: { app: Hono; upgradeWebSocket: UpgradeWebSocket },
) {
  app.get(
    '/jupyter',
    upgradeWebSocket((c) => {
      return jupyterWsAdapter.upgradeWebSocket();
    }),
  );
}
