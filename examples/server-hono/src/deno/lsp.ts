import type { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';

import { HonoYjsMemAdapter } from '@kerebron/extension-server-hono/HonoYjsMemAdapter';
import { LspWsAdapter } from '../lsp/lsp-server.ts';

import { proxyWs } from './proxyWs.ts';
import { proxyTcp } from '../lsp/proxyTcp.ts';
import { proxyProcess } from '../lsp/proxyProcess.ts';

const lspWsAdapter = new LspWsAdapter();

export function install(
  { app, upgradeWebSocket }: { app: Hono; upgradeWebSocket: UpgradeWebSocket },
) {
  app.get(
    '/lsp/mine',
    upgradeWebSocket((c) => {
      return lspWsAdapter.upgradeWebSocket();
    }),
  );

  app.get(
    '/lsp/process',
    upgradeWebSocket((c) => {
      return proxyProcess(
        'node',
        ['../../../lsp-toy/server/out/server.js'],
        c,
      );
    }),
  );

  app.get(
    '/lsp/yaml',
    upgradeWebSocket((c) => {
      return proxyProcess(
        'npm',
        ['exec', '--', 'yaml-language-server', '--stdio'],
        c,
      );
    }),
  );

  app.get(
    '/lsp/typescript',
    upgradeWebSocket((c) => {
      return proxyProcess(
        'npm',
        [
          'exec',
          '--package=typescript',
          '--package=typescript-language-server',
          '--',
          'typescript-language-server',
          '--stdio',
        ],
        c,
      );
    }),
  );

  app.get(
    '/lsp/tcp',
    upgradeWebSocket((c) => {
      return proxyTcp('127.0.0.1:2087', c);
    }),
  );

  app.get(
    '/lsp/deno',
    upgradeWebSocket((c) => {
      return proxyProcess(
        'deno',
        ['-L', 'debug', 'lsp'],
        c,
      );
    }),
  );
}
