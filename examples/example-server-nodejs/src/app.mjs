import fs from 'node:fs';

import { Hono } from 'hono';
import { proxy } from 'hono/proxy';
import { serveStatic } from '@hono/node-server/serve-static'
import { createNodeWebSocket } from '@hono/node-ws';
import { cors } from 'hono/cors';

import { HonoYjsMemAdapter } from '@kerebron/extension-server-hono/HonoYjsMemAdapter';

const __dirname = import.meta.dirname;

const yjsAdapter = new HonoYjsMemAdapter();

export class Server {

  constructor(opts = { devProxyUrls: {} }) {
    this.opts = opts;
    const app = new Hono();
    this.app = app;
    this.fetch = app.fetch;

    this.app.get('/api/rooms', async (c) => {
      const retVal = await yjsAdapter.getRoomNames();
      return c.json(retVal);
    });

    // Create WebSocket helpers
    const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });
    this.injectWebSocket = injectWebSocket;

    this.app.get(
      '/yjs/:room',
      upgradeWebSocket((c) => {
        console.log('upgradeWebSocket', c.req.path);
        return yjsAdapter.upgradeWebSocket(c.req.param('room'));
      }),
    );

    for (const path in this.opts.devProxyUrls) {
      const devProxyUrl = this.opts.devProxyUrls[path];
      console.log(`Proxy: ${path} => ${devProxyUrl}`);
      this.app.all(path + '/*', (c) => {
        const queryString = c.req.url
          .split('?')
          .map((e, idx) => {
            return idx > 0 ? e : '';
          })
          .join('?');

        const subPath = c.req.path;
        return proxy(`${devProxyUrl}${subPath}${queryString}`, {
          ...c.req, // optional, specify only when forwarding all the request data (including credentials) is necessary.
          headers: {
            ...c.req.header(),
            'X-Forwarded-For': '127.0.0.1',
            'X-Forwarded-Host': c.req.header('host'),
            Authorization: undefined, // do not propagate request headers contained in c.req.header('Authorization')
          },
        });
      });
    }

    this.app.notFound((c) => {
      const file = fs.readFileSync(
        __dirname + '/../public/index.html',
      );
      return c.html(new TextDecoder().decode(file));
    });
    this.app.use(
      '*',
      serveStatic({ root: __dirname + '/../public' }),
    );

    this.app.use('/*', cors());
  }
}
