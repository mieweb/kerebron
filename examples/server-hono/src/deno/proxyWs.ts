import { Context } from 'hono';
import { proxy } from 'hono/proxy';
import { upgradeWebSocket } from 'hono/deno';

export function proxyWs(
  proxyUrl: Parameters<typeof proxy>[0],
  proxyInit: Parameters<typeof proxy>[1],
  c: Context,
) {
  if (c.req.header('upgrade') === 'websocket') {
    const subProtocol = c.req.header('sec-websocket-protocol');
    const proxyWs = new WebSocket(
      new Request(proxyUrl).url.replace(/^http/, 'ws'),
      subProtocol,
    );

    return upgradeWebSocket(c, {
      onOpen(event, wsContext) {
        proxyWs.addEventListener('message', (event) => {
          if (wsContext.readyState === WebSocket.OPEN) {
            wsContext.send(event.data);
          }
        });
        proxyWs.addEventListener('close', () => {
          wsContext.close();
        });
      },
      onMessage(event, wsContext) {
        if (proxyWs.readyState === WebSocket.OPEN) {
          proxyWs.send(event.data);
        }
      },
      onClose() {
        proxyWs.close();
      },
    });
  }

  return proxy(proxyUrl, proxyInit);
}
