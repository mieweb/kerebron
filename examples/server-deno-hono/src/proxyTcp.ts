import { Context } from 'hono';
import type { WSContext, WSEvents } from 'hono/ws';

export function processText(
  text: string,
  dispatchEvent: (event: MessageEvent) => void,
) {
  let origText = text;

  let retry = true;
  let contentLength = 0;
  while (retry) {
    retry = false;
    const parts = text.split(/\r\n/);
    const firstLine = parts[0];
    if (firstLine.startsWith('Content-Length: ')) {
      contentLength = +firstLine.substring('Content-Length: '.length);
      let i = 1;
      while (i < parts.length) {
        if (parts[i] === '') {
          break;
        }
        i++;
      }
      text = parts.slice(i + 1).join('\r\n');
    }

    if (contentLength === 0) {
      return origText;
    }

    if (text.length < contentLength) {
      return origText;
    }

    const line = text.substring(0, contentLength);
    text = text.substring(contentLength);
    const event = new MessageEvent('message', {
      data: line,
    });
    dispatchEvent(event);

    contentLength = 0;
    retry = true;
    origText = text;
  }

  return origText;
}

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

  close(code?: number) {
    if (this.conn) {
      this.conn.close();
      this.conn = undefined;
    }
    this.dispatchEvent(new CloseEvent('close', { code }));
  }

  private async startReading() {
    if (!this.conn) {
      return;
    }
    let text = '';
    try {
      while (true) {
        const buf = new Uint8Array(4096);
        const n = await this.conn.read(buf);
        if (n === null) {
          // Remote closed the connection
          this.conn = undefined;
          this.dispatchEvent(new CloseEvent('close'));
          break;
        }

        const chunk = buf.subarray(0, n);
        text += this.decoder.decode(chunk, { stream: true });
        text = processText(text, (e) => this.dispatchEvent(e));
      }
    } catch (err) {
      if (err instanceof Deno.errors.BadResource) {
        console.log('Socket already closed');
      } else {
        console.error('Read error:', err, err.name, err.code);
      }
      this.close();
    }
    console.log('__ CLOSE');
    this.close();
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
        } else {
          console.error('LSP server not connected');
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

  onError(err: Event) {
    console.error(err);
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
