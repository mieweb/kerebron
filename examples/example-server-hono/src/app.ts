import { Hono } from 'hono';
import { proxy } from 'hono/proxy';
import { serveStatic, upgradeWebSocket } from 'hono/deno';
import { cors } from 'hono/cors';

import { HonoYjsMemAdapter } from '@kerebron/extension-server-hono/HonoYjsMemAdapter';

const __dirname = import.meta.dirname;

const app = new Hono();

const yjsAdapter = new HonoYjsMemAdapter();

export class Server {
  public app;
  public fetch;

  constructor(private opts: { devProxyUrl?: string } = {}) {
    this.app = app;
    this.fetch = app.fetch;

    this.app.get('/api/rooms', async (c) => {
      const retVal = await yjsAdapter.getRoomNames();
      return c.json(retVal);
    });

    this.app.get(
      '/yjs/:room',
      upgradeWebSocket((c) => {
        return yjsAdapter.upgradeWebSocket(c.req.param('room'));
      }),
    );

    if (opts.devProxyUrl) {
      this.app.get('*', (c) => {
        const queryString = c.req.url
          .split('?')
          .map((e: string, idx: number) => {
            return idx > 0 ? e : '';
          })
          .join('?');
        return proxy(`${opts.devProxyUrl}${c.req.path}${queryString}`);
      });
    } else {
      this.app.notFound((c) => {
        const file = Deno.readFileSync(
          __dirname + '/../../example-vue/dist/index.html',
        );
        return c.html(new TextDecoder().decode(file));
      });
      this.app.use(
        '*',
        serveStatic({ root: __dirname + '/../../example-vue/dist' }),
      );
    }

    this.app.use('/*', cors());
  }
}
