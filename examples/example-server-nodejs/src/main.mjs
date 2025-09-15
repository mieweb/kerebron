import { serve } from '@hono/node-server';
import { Server } from './app.mjs';

const server = new Server();
const nodejsServer = serve({
  fetch: server.fetch,
  port: 8080,
});
server.injectWebSocket(nodejsServer);

// graceful shutdown
process.on('SIGINT', () => {
  nodejsServer.close();
  process.exit(0);
})
process.on('SIGTERM', () => {
  nodejsServer.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
