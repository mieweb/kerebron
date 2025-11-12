import { Context } from 'hono';
import type { WSContext, WSEvents } from 'hono/ws';

class TcpClient extends EventTarget {
  private conn: Deno.Conn | undefined;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  constructor(public readonly host: string, public readonly port: number) {
    super();
  }

  async connect() {
    this.conn = await Deno.connect({ hostname: this.host, port: this.port });
    this.startReading();
  }

  async send(data: string | Uint8Array) {
    if (!this.conn) {
      return;
    }
    const payload = typeof data === 'string' ? this.encoder.encode(data) : data;
    const header = `Content-Length: ${payload.length}\r\n\r\n`;
    await this.conn.write(this.encoder.encode(header));
    await this.conn.write(payload);
  }

  close() {
    if (this.conn) {
      this.conn.close();
      this.conn = undefined;
    }
    this.dispatchEvent(new CloseEvent('close'));
  }

  private async startReading() {
    if (!this.conn) {
      return;
    }
    const buf = new Uint8Array(4096);
    try {
      while (true) {
        const n = await this.conn.read(buf);
        if (n === null) {
          // Remote closed the connection
          this.conn = undefined;
          this.dispatchEvent(new CloseEvent('close'));
          break;
        }

        const chunk = buf.subarray(0, n);
        const text = this.decoder.decode(chunk, { stream: true });

        const lines = text.split(/\r\n|\r|\n/)
          .filter((line) => !line.startsWith('Content-Length:'));

        for (const line of lines) {
          if (line.length > 0) {
            const event = new MessageEvent('message', {
              data: line,
            });
            this.dispatchEvent(event);
          }
        }
      }
    } catch (err) {
      if (err instanceof Deno.errors.BadResource) {
        console.log('Socket already closed');
      } else {
        console.error('Read error:', err);
      }
    } finally {
      this.close();
    }
  }
}

class ProxyContext implements WSEvents<WebSocket> {
  client: TcpClient | undefined;

  constructor(
    public readonly host: string,
    public readonly port: number,
    private c: Context,
  ) {
  }

  async onOpen(event: Event, wsContext: WSContext<WebSocket>) {
    const client = new TcpClient(this.host, this.port);
    await client.connect();

    this.client = client;

    client.addEventListener('message', (event) => {
      if (event instanceof MessageEvent) {
        if (wsContext.readyState === WebSocket.OPEN) {
          wsContext.send(event.data);
        }
      }
    });
    client.addEventListener('close', () => {
      wsContext.close();
    });
  }

  onMessage(event: Event, wsContext: WSContext<WebSocket>) {
    if (event instanceof MessageEvent) {
      if (this.client) {
        this.client.send(event.data);
      }
    }
  }

  onClose() {
    if (this.client) {
      this.client.close();
    }
  }

  onError() {
  }
}

export function proxyTcp(target: string, c: Context): WSEvents<WebSocket> {
  const [host, portStr] = target.split(':');
  const port = Number(portStr);
  if (!host || isNaN(port)) {
    throw new Error('Invalid target format, use host:port');
  }

  return new ProxyContext(host, port, c);
}
