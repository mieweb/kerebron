import {
  languageServerExtensions,
  LSPClient,
  type Transport,
} from '@codemirror/lsp-client';

export function simpleLspWebSocketTransport(uri: string): Promise<Transport> {
  let handlers: ((value: string) => void)[] = [];
  let sock = new WebSocket(uri);
  sock.onmessage = (e) => {
    for (let h of handlers) h(e.data.toString());
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
          handlers = handlers.filter((h) => h != handler);
        },
      });
  });
}
