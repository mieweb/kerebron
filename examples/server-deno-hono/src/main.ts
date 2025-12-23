import { Server } from './app.ts';
import { createServer as createViteServer } from 'vite';

const __dirname = import.meta.dirname;

const devProxyUrls: Record<string, string> = {};

const examples = Array
  .from(Deno.readDirSync(__dirname + '/../..'))
  .filter((example) => example.isDirectory)
  .map((example) => example.name);

let port = undefined;
const broswerExamples = examples.filter((example) =>
  example.startsWith('browser-')
);
for (const exampleName of broswerExamples) {
  const viteDevServer = await createViteServer({
    base: '/examples-frame/' + exampleName,
    configFile: __dirname + '/../../' + exampleName + '/vite.config.ts',
    root: __dirname + '/../../' + exampleName,
    server: {
      port,
      fs: { // https://vite.dev/config/server-options.html#server-fs-allow
        allow: [__dirname + '/../../../'],
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

const server = new Server({ devProxyUrls });

// Generate self-signed certificate for HTTPS development
const generateCert = async () => {
  const cmd = new Deno.Command('openssl', {
    args: [
      'req',
      '-x509',
      '-newkey',
      'rsa:4096',
      '-keyout',
      '/tmp/key.pem',
      '-out',
      '/tmp/cert.pem',
      '-days',
      '365',
      '-nodes',
      '-subj',
      '/CN=localhost',
    ],
    stderr: 'piped',
    stdout: 'piped',
  });
  await cmd.output();
};

// Check if certs exist, if not generate them
try {
  await Deno.stat('/tmp/cert.pem');
  await Deno.stat('/tmp/key.pem');
} catch {
  console.log('Generating self-signed certificates...');
  await generateCert();
}

const cert = await Deno.readTextFile('/tmp/cert.pem');
const key = await Deno.readTextFile('/tmp/key.pem');

Deno.serve({
  port: 8000,
  cert,
  key,
}, server.fetch);
