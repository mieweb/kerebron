import type { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';

import { HonoYjsMemAdapter } from '@kerebron/extension-server-hono/HonoYjsMemAdapter';
const yjsAdapter = new HonoYjsMemAdapter();

export function install(
  { app, upgradeWebSocket }: { app: Hono; upgradeWebSocket: UpgradeWebSocket },
) {
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
}
