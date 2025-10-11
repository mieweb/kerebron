import { Hono } from 'hono';
import { proxy } from 'hono/proxy';
import { serveStatic, upgradeWebSocket } from 'hono/deno';
import { cors } from 'hono/cors';

import { HonoYjsMemAdapter } from '@kerebron/extension-server-hono/HonoYjsMemAdapter';
import { proxyWs } from './proxyWs.ts';
import { LspWsAdapter } from './lsp-server.ts';

const __dirname = import.meta.dirname;

const app = new Hono();

const yjsAdapter = new HonoYjsMemAdapter();
const lspWsAdapter = new LspWsAdapter();

export class Server {
  public app;
  public fetch;

  constructor(
    private opts: { devProxyUrls: Record<string, string> } = {
      devProxyUrls: {},
    },
  ) {
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

    this.app.get(
      '/lsp',
      upgradeWebSocket((c) => {
        return lspWsAdapter.upgradeWebSocket();
      }),
    );

    for (const path in this.opts.devProxyUrls) {
      const devProxyUrl = this.opts.devProxyUrls[path];
      console.log(`Proxy: ${path} => ${devProxyUrl}`);

      this.app.all(path + '/*', async (c) => {
        const queryString = c.req.url
          .split('?')
          .map((e: string, idx: number) => {
            return idx > 0 ? e : '';
          })
          .join('?');

        const subPath = c.req.path;

        const proxyUrl = `${devProxyUrl}${subPath}${queryString}`;
        //console.debug(`Proxy call: ${c.req.method} ${proxyUrl}`)

        return proxyWs(proxyUrl, {
          ...c.req, // optional, specify only when forwarding all the request data (including credentials) is necessary.
          headers: {
            ...c.req.header(),
            'X-Forwarded-For': '127.0.0.1',
            'X-Forwarded-Host': c.req.header('host'),
            Authorization: undefined, // do not propagate request headers contained in c.req.header('Authorization')
          },
        }, c);
      });
    }

    this.app.notFound((c) => {
      const file = Deno.readFileSync(
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
