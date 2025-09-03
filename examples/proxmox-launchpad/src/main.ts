import { Server } from './app.ts';
import { createServer as createViteServer } from 'npm:vite';

const __dirname = import.meta.dirname;

// const viteDevServer = null;
const viteDevServer = await createViteServer({
  // any valid user config options, plus `mode` and `configFile`
  configFile: __dirname + '/../../example-vue/vite.config.ts',
  root: __dirname + '/../../example-vue',
  server: {
    // middlewareMode: true
    port: 1337,
  },
  // appType: 'custom'
});
await viteDevServer.listen();

const server = new Server({ devProxyUrl: 'http://localhost:1337' });
Deno.serve(server.fetch);
