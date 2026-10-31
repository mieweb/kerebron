import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic, upgradeWebSocket } from 'hono/deno';

import { generateAlias } from '../../../utils/vite-plugins/generateAlias.ts';
import { minifyCss } from './compiler.ts';

const __dirname = import.meta.dirname;

const port = 8000;

const app = new Hono();

app.use(
  '/*',
  cors({
    origin: ['http://localhost:' + port, 'https://kerebron.com'],
  }),
);

(await import('./deno/yjs.ts')).install({ app, upgradeWebSocket });
(await import('./deno/lsp.ts')).install({ app, upgradeWebSocket });
await (await import('./deno/devViteProxy.ts')).install({ app });
(await import('./dynamic/docs.ts')).install({ app });
await (await import('./dynamic/examples.ts')).install({ app });

const aliases = generateAlias();
for (const [alias, dir] of Object.entries(aliases)) {
  console.log('/assets/' + alias, dir);

  app.get('/assets/' + alias + '/*', async (c) => {
    const path = new URL(c.req.url).pathname;
    const fullPath = dir + path.substring(('/assets/' + alias).length);

    try {
      const { css } = await minifyCss(fullPath);

      if (css) {
        c.status(200);
        c.header('Content-Type', 'text/css');
        return c.body(css + `/*# sourceMappingURL=${path}.map */`, 200);
      } else {
        return c.notFound();
      }
    } catch (err) {
      return c.body(JSON.stringify(err), 501);
    }
  });
}

app.use(
  '*',
  serveStatic({
    root: __dirname + '/../public',
    mimes: { 'wasm': 'application/wasm' },
  }),
);

Deno.serve({ port }, app.fetch);
