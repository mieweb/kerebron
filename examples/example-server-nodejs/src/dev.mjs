import { serve } from '@hono/node-server';
import { createServer as createViteServer } from 'npm:vite';

import { Server } from './app.mjs';

const __dirname = import.meta.dirname;

const viteDevServer = await createViteServer({
  // any valid user config options, plus `mode` and `configFile`
  base: '/examples/example-vue-custom-element',
  configFile: __dirname + '../../example-vue-custom-element/vite.config.ts', // TODO add vite-npm-resolver-plugin.mjs for nodejs
  root: __dirname + '/../../example-vue-custom-element',
  server: {
    // middlewareMode: true
    port: 1337,
  },
  // appType: 'custom'
});
await viteDevServer.listen();

const server = new Server({ devProxyUrls: { '/examples/example-vue-custom-element': 'http://localhost:1337' } });
serve(server.app);
