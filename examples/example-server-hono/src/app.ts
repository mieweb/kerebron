import { Hono } from 'hono';
import { proxy } from 'hono/proxy';
import { serveStatic, upgradeWebSocket } from 'hono/deno';
import { cors } from 'hono/cors';
import { createServer as createViteServer } from 'npm:vite';

import { getRoomNames, HonoYjsAdapter } from './yjs/HonoYjsAdapter.ts';

const __dirname = import.meta.dirname;

const app = new Hono();

app.get('/api/rooms', async (c) => {
  const retVal = await getRoomNames();
  return c.json(retVal);
});

const yjsAdapter = new HonoYjsAdapter();

app.get(
  '/yjs/:room',
  upgradeWebSocket((c) => {
    return yjsAdapter.upgradeWebSocket(c.req.param('room'));
  }),
);


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

if (viteDevServer) {
  await viteDevServer.listen();
  app.get('*', (c) => {
    const queryString = c.req.url.split('?').map((e, idx) => {
      return idx > 0 ? e : '';
    }).join('?');
    return proxy(`http://localhost:1337${c.req.path}${queryString}`);
  });
} else {
  app.notFound((c) => {
    const file = Deno.readFileSync(
      __dirname + '/../../example-vue/dist/index.html',
    );
    return c.html(new TextDecoder().decode(file));
  });
  app.use('*', serveStatic({ root: __dirname + '/../../example-vue/dist' }));
}

app.use('/*', cors());

export class Server {
  public app;
  public fetch;

  constructor() {
    this.app = app;
    this.fetch = app.fetch;
  }
}

export default app;
