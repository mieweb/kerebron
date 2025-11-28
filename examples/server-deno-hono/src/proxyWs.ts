import { Context } from 'hono';
import { proxy } from 'hono/proxy';

export function proxyWs(
  proxyUrl: Parameters<typeof proxy>[0],
  proxyInit: Parameters<typeof proxy>[1],
  c: Context,
) {
  if (c.req.header('upgrade') === 'websocket') {
    const subProtocol = c.req.header('sec-websocket-protocol');
    const proxyWsUrl = new Request(proxyUrl).url.replace(/^http/, 'ws');

    // Use Deno's native WebSocket upgrade with protocol support
    const upgrade = Deno.upgradeWebSocket(c.req.raw, {
      protocol: subProtocol || undefined,
    });

    const proxyWs = new WebSocket(
      proxyWsUrl,
      subProtocol ? subProtocol.split(',').map((p) => p.trim()) : undefined,
    );

    // Forward messages from proxy to client
    proxyWs.addEventListener('message', (event) => {
      if (upgrade.socket.readyState === WebSocket.OPEN) {
        upgrade.socket.send(event.data);
      }
    });

    // Forward messages from client to proxy
    upgrade.socket.addEventListener('message', (event) => {
      if (proxyWs.readyState === WebSocket.OPEN) {
        proxyWs.send(event.data);
      }
    });

    // Handle close events
    proxyWs.addEventListener('close', () => {
      upgrade.socket.close();
    });

    upgrade.socket.addEventListener('close', () => {
      proxyWs.close();
    });

    // Handle errors
    proxyWs.addEventListener('error', (err) => {
      console.error('Proxy WebSocket error:', err);
      upgrade.socket.close();
    });

    upgrade.socket.addEventListener('error', (err) => {
      console.error('Client WebSocket error:', err);
      proxyWs.close();
    });

    return upgrade.response;
  }

  return proxy(proxyUrl, proxyInit);
}
