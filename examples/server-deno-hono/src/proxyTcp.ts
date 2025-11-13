import { Context } from 'hono';
import type { WSContext, WSEvents } from 'hono/ws';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function processText(
  arr: Uint8Array,
  dispatchEvent: (event: MessageEvent) => void,
): Uint8Array {
  let retry = true;
  while (retry) {
    retry = false;

    const asText = decoder.decode(arr);

    const parts = asText.split('\r\n');
    const headers = [];
    for (let i = 0; i < parts.length; i++) {
      headers.push(parts[i]);
      if (parts[i] === '') {
        break;
      }
    }

    if (headers.length >= parts.length) {
      return arr;
    }

    const contentLenLine = headers.find((line) =>
      line.startsWith('Content-Length: ')
    );
    if (!contentLenLine) {
      return arr;
    }

    const contentLength = +contentLenLine.substring('Content-Length: '.length)
      .trim();
    if (contentLength === 0) {
      return arr;
    }

    const headersSize = encoder.encode(headers.join('\r\n')).length + 2;
    const rest = arr.subarray(headersSize);

    if (rest.length < contentLength) {
      return arr;
    }

    const line = decoder.decode(rest.subarray(0, contentLength));
    arr = rest.subarray(contentLength);

    const event = new MessageEvent('message', {
      data: line,
    });
    dispatchEvent(event);

    retry = true;
  }

  return arr;
}

class TcpClient extends EventTarget {
  private conn: Deno.Conn | undefined;

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
    const payload = typeof data === 'string' ? encoder.encode(data) : data;
    const header = `Content-Length: ${payload.length}\r\n\r\n`;
    await this.conn.write(encoder.encode(header));
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
    let arr = new Uint8Array();
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
        const concat = new Uint8Array(arr.length + chunk.length);
        concat.set(arr, 0);
        concat.set(chunk, arr.length);

        arr = Uint8Array.from(
          processText(concat, (e) => this.dispatchEvent(e)),
        );
      }
    } catch (err) {
      if (err instanceof Deno.errors.BadResource) {
        console.log('Socket already closed');
      } else {
        console.error('Read error:', err, err.name, err.code);
      }
      this.close();
    }
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
