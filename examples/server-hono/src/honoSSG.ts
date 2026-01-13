import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic, upgradeWebSocket } from 'hono/deno';

import './importMetaPonyFill.ts';

const __dirname = import.meta.dirname;

const app = new Hono();

app.use(
  '/*',
  cors({
    origin: ['https://kerebron.com'],
    allowMethods: ['GET', 'OPTIONS'],
  }),
);

(await import('./cf/yjs.ts')).install({ app, upgradeWebSocket });
await (await import('./dynamic/examples.ts')).install({ app, isBuild: true });
(await import('./dynamic/docs.ts')).install({ app });

app.use(
  '*',
  serveStatic({
    root: __dirname + '/../public',
    mimes: { 'wasm': 'application/wasm' },
  }),
);

export default app;
