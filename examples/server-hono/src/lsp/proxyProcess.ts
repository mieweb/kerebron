import { Context } from 'hono';
import type { WSContext, WSEvents } from 'hono/ws';
import { processText } from './proxyTcp.ts';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

class ProcessClient extends EventTarget {
  process: Deno.ChildProcess | undefined;
  writer: WritableStreamDefaultWriter<Uint8Array<ArrayBufferLike>> | undefined;

  constructor(
    public readonly execPath: string,
    public readonly args: string[],
  ) {
    super();
  }

  connect() {
    const command = new Deno.Command(this.execPath, {
      args: this.args,
      stdin: 'piped',
      stdout: 'piped',
      stderr: 'piped',
      env: {
        'LSP_TOY_DEBUG': 'true',
        'RUST_BACKTRACE': 'full',
      },
    });
    this.process = command.spawn();

    this.writer = this.process.stdin.getWriter();
    this.dispatchEvent(new Event('open'));
    this.startDebugger();
    this.startReading();
  }

  async send(data: string | Uint8Array) {
    if (!this.process || !this.writer) {
      return;
    }
    const payload = typeof data === 'string' ? encoder.encode(data) : data;
    const header = `Content-Length: ${payload.length}\r\n\r\n`;
    await this.writer.write(encoder.encode(header));
    await this.writer.write(payload);
  }

  close() {
    if (this.process) {
      try {
        this.process.kill();
      } catch (err) {
        console.error(err);
      }
      this.process = undefined;
    }
    this.dispatchEvent(new CloseEvent('close'));
  }

  private async startDebugger() {
    if (!this.process) {
      return;
    }
    try {
      for await (const chunk of this.process.stderr) {
        const text = decoder.decode(chunk, { stream: true });

        if (text) {
          console.debug('DEBUG:', text);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  private async startReading() {
    if (!this.process) {
      return;
    }

    let arr = new Uint8Array();
    try {
      for await (const value of this.process.stdout) {
        if (!value) {
          // Remote closed the connection
          this.process = undefined;
          this.dispatchEvent(new CloseEvent('close'));
          break;
        }

        const concat = new Uint8Array(arr.length + value.length);
        concat.set(arr, 0);
        concat.set(value, arr.length);

        arr = Uint8Array.from(
          processText(concat, (e) => this.dispatchEvent(e)),
        );
      }
    } catch (err) {
      if (err instanceof Deno.errors.BadResource) {
        console.warn('Socket already closed');
      } else {
        console.error('Read error:', err);
      }
    } finally {
      this.close();
    }
  }
}

class ProxyContext implements WSEvents<WebSocket> {
  client: ProcessClient;

  constructor(
    public readonly execPath: string,
    public readonly args: string[],
    private c: Context,
  ) {
    this.client = new ProcessClient(this.execPath, this.args);
  }

  onOpen(event: Event, wsContext: WSContext<WebSocket>) {
    this.client.addEventListener('message', (event) => {
      if (event instanceof MessageEvent) {
        // console.log('LSP says:', event.data);
        if (wsContext.readyState === WebSocket.OPEN) {
          wsContext.send(event.data);
        }
      }
    });
    this.client.addEventListener('close', () => {
      console.info('LSP server closed', wsContext.readyState);
      wsContext.close();
    });
    this.client.addEventListener('open', () => {
      console.info('LSP server open');
    });
    this.client.connect();
  }

  onMessage(event: Event, wsContext: WSContext<WebSocket>) {
    if (event instanceof MessageEvent) {
      if (this.client) {
        // console.log('BROWSER says:', event.data);
        this.client.send(event.data);
      }
    }
  }

  onClose(event: Event) {
    console.info('BROWSER close:', 'code' in event ? event.code : '');
    if (this.client) {
      this.client.close();
    }
  }

  onError() {
  }
}

export function proxyProcess(
  execPath: string,
  args: string[],
  c: Context,
): WSEvents<WebSocket> {
  const proxy = new ProxyContext(execPath, args, c);
  return proxy;
}
