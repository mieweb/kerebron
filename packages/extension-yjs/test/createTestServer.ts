import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { upgradeWebSocket } from 'hono/deno';
import { HonoYjsMemAdapter } from '@kerebron/extension-server-hono/HonoYjsMemAdapter';

let port = 34000;

export async function createTestServer(): Promise<Deno.HttpServer> {
  const yjsAdapter = new HonoYjsMemAdapter();

  const app = new Hono();

  app.use(
    '/*',
    cors({
      origin: ['http://localhost:' + port, 'https://kerebron.com'],
    }),
  );

  app.get(
    '/yjs/:room',
    upgradeWebSocket((c) => {
      return yjsAdapter.upgradeWebSocket(c.req.param('room'));
    }),
  );

  app.get('/api/rooms', (c) => {
    const retVal = yjsAdapter.getRoomNames();
    return c.json(retVal);
  });

  app.post('/api/rooms', (c) => {
    const roomId = String(Math.floor(100000 / Math.random()));
    yjsAdapter.addRoom(roomId);
    return c.json(roomId);
  });

  while (true) {
    try {
      const server = Deno.serve({ port }, app.fetch);
      return server;
    } catch (err: any) {
      if ('EADDRINUSE' === err.code) {
        port++;
      } else {
        throw err;
      }
    }
  }
}

export function shutdownServer(server: Deno.HttpServer) {
  server.shutdown();
}
