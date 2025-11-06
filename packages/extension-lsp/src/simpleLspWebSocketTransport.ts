import { type Transport } from './client.ts';

export function simpleLspWebSocketTransport(uri: string): Promise<Transport> {
  const handlers: ((value: string) => void)[] = [];
  const sock = new WebSocket(uri);
  sock.onmessage = (e) => {
    for (const h of handlers) {
      h(e.data.toString());
    }
  };
  return new Promise((resolve) => {
    sock.onopen = () =>
      resolve({
        send(message: string) {
          sock.send(message);
        },
        subscribe(handler: (value: string) => void) {
          handlers.push(handler);
        },
        unsubscribe(handler: (value: string) => void) {
          handlers.splice(
            0,
            handlers.length,
            ...handlers.filter((h) => h != handler),
          );
        },
      });
  });
}
