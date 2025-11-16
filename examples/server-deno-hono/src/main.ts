import { Server } from './app.ts';
import { createServer as createViteServer } from 'npm:vite';

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
// Configure Deno.serve with WebSocket idle timeout disabled
// to prevent "No response from ping frame" errors in long-lived collaborative sessions
Deno.serve({
  onListen: ({ port, hostname }) => {
    // Use localhost instead of 0.0.0.0 for better browser compatibility (Safari)
    const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
    console.log(`\n=================================================`);
    console.log(`\nAvailable examples (proxied from Vite):`);
    for (const examplePath in devProxyUrls) {
      const viteUrl = devProxyUrls[examplePath];
      const honoUrl = `http://${displayHost}:${port}${examplePath}`;
      console.log(`  ${examplePath}`);
      console.log(`    Editor:  ${honoUrl} synced by Hono:  ${viteUrl}`);
    }
    console.log(`=================================================`);
    console.log(`Server running on http://${displayHost}:${port}`);
    console.log(`\n=================================================\n`);
  },
}, server.fetch);
