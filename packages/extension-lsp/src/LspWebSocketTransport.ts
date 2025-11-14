import { type Transport } from './LSPClient.ts';

function shouldReconnectOnCode(code: number) {
  // https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
  // Reconnect on server going away (1001), but NOT on normal close (1000)
  const reconnectCodes = [1001, 1006, 1011, 1012, 1013];
  return reconnectCodes.includes(code);
}

export class LspWebSocketTransport extends EventTarget implements Transport {
  socket: WebSocket | undefined;
  private reconnectAttempts = 0;
  private maxAttempts = 10;
  private readonly baseDelay = 1000;
  isConnecting: boolean = false;

  constructor(public readonly uri: string) {
    super();
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.isConnecting) {
      return;
    }
    this.isConnecting = true;
    this.socket?.close();
    const socket = new WebSocket(this.uri);
    this.bindEvents(socket);
    this.socket = socket;
  }

  disconnect(): void {
    console.info('LSP transport disconnect()');
    this.socket?.close();
    this.socket = undefined;
    this.reconnectAttempts = 0;
  }

  bindEvents(socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      if (event.data.indexOf('LSP ready') > -1) {
        this.dispatchEvent(new Event('ready'));
      }
      this.dispatchEvent(new MessageEvent('message', { data: event.data }));
    });
    socket.addEventListener('open', (event) => {
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      this.dispatchEvent(new CustomEvent('connected'));
    });
    socket.addEventListener('error', (event) => {
      console.error(event);
      this.dispatchEvent(event);
    });
    socket.addEventListener('close', (event) => {
      this.isConnecting = false;
      this.dispatchEvent(
        new CloseEvent('close', {
          code: event.code,
        }),
      );
      this.socket = undefined;
      if (!event.wasClean || shouldReconnectOnCode(event.code)) {
        this.scheduleReconnect();
      } else {
        console.info('Clean close — no reconnect');
      }
    });
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.info(
      `Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`,
    );
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(message: string): void {
    if (!this.socket) {
      console.warn('Socket disconnected');
      return;
    }
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    } else {
      console.warn('WebSocket not open: ' + this.socket.readyState);
    }
  }
}
