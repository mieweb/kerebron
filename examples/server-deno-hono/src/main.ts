import { Server } from './app.ts';
import { createServer as createViteServer } from 'vite';

const __dirname = import.meta.dirname;

const devProxyUrls: Record<string, string> = {};

let port = undefined;
for (
  const exampleName of [
    'browser-vanilla-code-editor',
    'browser-vue',
    'browser-vue-custom-element',
    'browser-vue-lsp',
  ]
) {
  const viteDevServer = await createViteServer({
    base: '/examples/' + exampleName,
    configFile: __dirname + '/../../' + exampleName + '/vite.config.ts',
    root: __dirname + '/../../' + exampleName,
    server: {
      port,
      fs: { // https://vite.dev/config/server-options.html#server-fs-allow
        allow: [__dirname + '/../../../'],
      },
    },
  });
  const proxyServer = await viteDevServer.listen();
  const addr = proxyServer.httpServer?.address();
  if (addr && 'object' === typeof addr) {
    devProxyUrls['/examples/' + exampleName] =
      `http://${addr.address}:${addr.port}`;
    port = addr.port + 1;
  }
}

const server = new Server({ devProxyUrls });
Deno.serve(server.fetch);
