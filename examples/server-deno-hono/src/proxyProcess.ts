import { Context } from 'hono';
import type { WSContext, WSEvents } from 'hono/ws';

class ProcessClient extends EventTarget {
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  process: Deno.ChildProcess | undefined;
  writer: WritableStreamDefaultWriter<Uint8Array<ArrayBufferLike>> | undefined;

  constructor(
    public readonly execPath: string,
    public readonly args: string[],
  ) {
    super();

    const command = new Deno.Command(this.execPath, {
      args: this.args,
      stdin: 'piped',
      stdout: 'piped',
      stderr: 'piped',
      env: {
        'LSP_TOY_DEBUG': 'true',
      },
    });
    this.process = command.spawn();

    this.writer = this.process.stdin.getWriter();
    this.startReading();
    this.startDebugger();
  }

  async connect() {
  }

  async send(data: string | Uint8Array) {
    if (!this.process || !this.writer) {
      return;
    }
    const payload = typeof data === 'string' ? this.encoder.encode(data) : data;
    const header = `Content-Length: ${payload.length}\r\n\r\n`;
    await this.writer.write(this.encoder.encode(header));
    await this.writer.write(payload);
  }

  close() {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    this.dispatchEvent(new CloseEvent('close'));
  }

  private async startDebugger() {
    if (!this.process) {
      return;
    }
    const reader = this.process.stderr.getReader();
    try {
      while (true) {
        const n = await reader.read();
        const chunk = n.value;
        const text = this.decoder.decode(chunk, { stream: true });
        console.error('DEBUG:', text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.close();
    }
  }

  private async startReading() {
    if (!this.process) {
      return;
    }
    const reader = this.process.stdout.getReader();

    try {
      while (true) {
        const n = await reader.read();
        if (n === null) {
          // Remote closed the connection
          this.process = undefined;
          this.dispatchEvent(new CloseEvent('close'));
          break;
        }

        const chunk = n.value;
        const text = this.decoder.decode(chunk, { stream: true });

        const event = new MessageEvent('message', {
          data: text,
        });
        this.dispatchEvent(event);
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
  client: ProcessClient;

  constructor(
    public readonly execPath: string,
    public readonly args: string[],
    private c: Context,
  ) {
    this.client = new ProcessClient(this.execPath, this.args);
  }

  async onOpen(event: Event, wsContext: WSContext<WebSocket>) {
    await this.client.connect();

    this.client.addEventListener('message', (event) => {
      if (event instanceof MessageEvent) {
        if (wsContext.readyState === WebSocket.OPEN) {
          wsContext.send(event.data);
        }
      }
    });
    this.client.addEventListener('close', () => {
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

export async function proxyProcess(
  execPath: string,
  args: string[],
  c: Context,
): Promise<WSEvents<WebSocket>> {
  const proxy = new ProxyContext(execPath, args, c);
  await new Promise((res) => setTimeout(res, 1000));
  return proxy;
}
