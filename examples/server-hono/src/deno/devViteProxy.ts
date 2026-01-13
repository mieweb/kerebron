import type { Hono } from 'hono';

import { createServer as createViteServer } from 'vite';
import { proxyWs } from './proxyWs.ts';

const __dirname = import.meta.dirname;
const examplesDir = __dirname + '/../../../';

export async function install({ app }: { app: Hono }) {
  const devProxyUrls: Record<string, string> = {};

  const examples = Array
    .from(Deno.readDirSync(examplesDir))
    .filter((example) => example.isDirectory)
    .map((example) => example.name);

  let port = undefined;
  const browserExamples = examples.filter((example) =>
    example.startsWith('browser-')
  );
  for (const exampleName of browserExamples) {
    const viteDevServer = await createViteServer({
      base: '/examples-frame/' + exampleName,
      configFile: examplesDir + exampleName + '/vite.config.ts',
      root: examplesDir + exampleName,
      server: {
        port,
        fs: { // https://vite.dev/config/server-options.html#server-fs-allow
          allow: [examplesDir],
        },
      },
    });
    const proxyServer = await viteDevServer.listen();
    const addr = proxyServer.httpServer?.address();
    if (addr && 'object' === typeof addr) {
      devProxyUrls['/examples-frame/' + exampleName] =
        `http://${addr.address}:${addr.port}`;
      port = addr.port + 1;
    }
  }

  for (const path in devProxyUrls) {
    const devProxyUrl = devProxyUrls[path];
    console.log(`Proxy: ${path} => ${devProxyUrl}`);

    app.all(path + '/*', (c) => {
      const queryString = c.req.url
        .split('?')
        .map((e: string, idx: number) => {
          return idx > 0 ? e : '';
        })
        .join('?');

      const subPath = c.req.path;

      const proxyUrl = `${devProxyUrl}${subPath}${queryString}`;

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
}
