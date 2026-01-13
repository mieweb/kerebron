import { WSEvents } from 'hono/ws';

export interface HonoWsAdapter {
  upgradeWebSocket(roomName: string, env?: any): WSEvents<WebSocket>;
}
