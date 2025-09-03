import { WSEvents } from 'hono/ws';

export interface HonoWsAdapter {
  upgradeWebSocket(roomName: string): WSEvents<WebSocket>;
}
