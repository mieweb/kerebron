import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic, upgradeWebSocket } from 'hono/deno';

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
app.use(
  '*',
  serveStatic({
    root: __dirname + '/../public',
    mimes: { 'wasm': 'application/wasm' },
  }),
);

Deno.serve({ port }, app.fetch);
