import type { Hono } from 'hono';

export function install(
  { app }: { app: Hono },
) {
  app.get(
    '/yjs/:room',
    async (c) => {
      const roomName = c.req.param('room');
      const id = c.env.YJS_ROOM.idFromName(roomName);
      const room = c.env.YJS_ROOM.get(id);
      return room.fetch(c.req.raw);
    },
  );

  // You cannot enumerate CF durable objects
  // app.get('/api/rooms', (c) => {
  // });
}
