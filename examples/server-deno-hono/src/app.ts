import { Hono } from 'hono';
import { serveStatic, upgradeWebSocket } from 'hono/deno';
import { cors } from 'hono/cors';

import { HonoYjsMemAdapter } from '@kerebron/extension-server-hono/HonoYjsMemAdapter';
import { proxyWs } from './proxyWs.ts';
import { LspWsAdapter } from './lsp-server.ts';
import { proxyTcp } from './proxyTcp.ts';
import { proxyProcess } from './proxyProcess.ts';
import { ventoEnv } from './vento.ts';

const __dirname = import.meta.dirname;

const app = new Hono();

const yjsAdapter = new HonoYjsMemAdapter();
const lspWsAdapter = new LspWsAdapter();

const examples = Array
  .from(Deno.readDirSync(__dirname + '/../..'))
  .filter((file) => file.isDirectory && file.name.startsWith('browser-'))
  .map((file) => file.name);

export class Server {
  public app;
  public fetch;

  constructor(
    private opts: {
      devProxyUrls: Record<string, string>;
      lspEnabled?: boolean;
    } = {
      devProxyUrls: {},
      lspEnabled: false,
    },
  ) {
    this.app = app;
    this.fetch = app.fetch;

    const docSites = Array
      .from(Deno.readDirSync(__dirname + '/../../../docs'))
      .filter((file) => file.isFile && file.name.endsWith('.md'))
      .map((file) => file.name);

    for (const docSite of docSites) {
      let targetUri = docSite.replace('.md', '');
      if (targetUri.endsWith('/index')) {
        targetUri = targetUri.substring(0, targetUri.length - '/index'.length);
      }
      if (targetUri === 'index') {
        targetUri = '';
      }

      this.app.get('/' + targetUri, async (c) => {
        const buffer = await Deno.readFile(
          __dirname + '/../../../docs/' + docSite,
        );
        const md = new TextDecoder().decode(buffer);

        const template = await ventoEnv.load('static.vto');
        const result = await template({ md: md, examples });

        return c.html(result.content);
      });
    }

    for (const example of examples) {
      this.app.get('/examples/' + example + '/', async (c) => {
        const template = await ventoEnv.load('example.vto');
        const result = await template({
          src: `/examples-frame/${example}`,
          examples,
        });
        return c.html(result.content);
      });
    }

    this.app.get('/examples/:example', (c) => {
      const example = c.req.param('example');
      return c.redirect(`/examples/${example}/`, 301);
    });

    this.app.get('/api/rooms', (c) => {
      const retVal = yjsAdapter.getRoomNames();
      return c.json(retVal);
    });

    this.app.get(
      '/yjs/:room',
      upgradeWebSocket((c) => {
        return yjsAdapter.upgradeWebSocket(c.req.param('room'));
      }),
    );

    if (this.opts.lspEnabled) {
      this.app.get(
        '/lsp/mine',
        upgradeWebSocket((c) => {
          return lspWsAdapter.upgradeWebSocket();
        }),
      );

      this.app.get(
        '/lsp/process',
        upgradeWebSocket((c) => {
          return proxyProcess(
            'node',
            ['../../../lsp-toy/server/out/server.js'],
            c,
          );
        }),
      );

      this.app.get(
        '/lsp/yaml',
        upgradeWebSocket((c) => {
          return proxyProcess(
            'npm',
            ['exec', '--', 'yaml-language-server', '--stdio'],
            c,
          );
        }),
      );

      this.app.get(
        '/lsp/typescript',
        upgradeWebSocket((c) => {
          return proxyProcess(
            'npm',
            [
              'exec',
              '--package=typescript',
              '--package=typescript-language-server',
              '--',
              'typescript-language-server',
              '--stdio',
            ],
            c,
          );
        }),
      );

      this.app.get(
        '/lsp/tcp',
        upgradeWebSocket((c) => {
          return proxyTcp('127.0.0.1:2087', c);
        }),
      );

      this.app.get(
        '/lsp/deno',
        upgradeWebSocket((c) => {
          return proxyProcess(
            'deno',
            ['-L', 'debug', 'lsp'],
            c,
          );
        }),
      );

      console.log('LSP: enabled');
    } else {
      console.log('LSP: disabled');
    }

    for (const path in this.opts.devProxyUrls) {
      const devProxyUrl = this.opts.devProxyUrls[path];
      console.log(`Proxy: ${path} => ${devProxyUrl}`);

      this.app.all(path + '/*', (c) => {
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

    this.app.notFound(async (c) => {
      const template = await ventoEnv.load('404.vto');
      const result = await template({ examples });

      // const file = Deno.readFileSync(
      //   __dirname + '/../public/index.html',
      // );
      return c.html(result.content);
    });
    this.app.use(
      '*',
      serveStatic({
        root: __dirname + '/../public',
        mimes: { 'wasm': 'application/wasm' },
      }),
    );
    this.app.use('/*', cors());
  }
}
