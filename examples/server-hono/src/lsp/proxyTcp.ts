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

    // console.log('LSP says: ', line);

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
    this.dispatchEvent(new Event('open'));

    const message = {
      'jsonrpc': '2.0',
      'method': 'window/logMessage',
      'params': { 'type': 4, 'message': 'LSP ready' },
    };
    this.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify(message),
      }),
    );

    this.startReading();
  }

  async send(data: string | Uint8Array) {
    if (!this.conn) {
      return;
    }
    const payload: Uint8Array = typeof data === 'string'
      ? encoder.encode(data)
      : data;
    const header: Uint8Array = encoder.encode(
      `Content-Length: ${payload.length}\r\n\r\n`,
    );

    const packet = new Uint8Array(header.length + payload.length);
    packet.set(header, 0);
    packet.set(payload, header.length);

    await this.conn.write(packet);
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
    } catch (err: any) {
      if (err instanceof Deno.errors.BadResource) {
        console.warn('Socket already closed');
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
      console.info('LSP server closed');
      wsContext.close();
    });
    client.addEventListener('open', () => {
      console.info('LSP server open');
    });

    try {
      await client.connect();
    } catch (err: any) {
      if (err.message.indexOf('Connection refused') > -1) {
        wsContext.send(
          JSON.stringify({
            'jsonrpc': '2.0',
            'method': 'window/logMessage',
            'params': { 'type': 1, 'message': err.message },
          }),
        );
        setTimeout(() => {
          wsContext.close();
        }, 100);
      } else {
        console.error(err);
        wsContext.close();
      }
    }
  }

  onMessage(event: Event, wsContext: WSContext<WebSocket>) {
    if (event instanceof MessageEvent) {
      if (this.client) {
        // console.log('BROWSER says: ', event.data);
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
