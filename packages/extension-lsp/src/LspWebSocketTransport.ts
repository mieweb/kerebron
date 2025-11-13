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

  constructor(public readonly uri: string) {
    super();
    this.connect();
  }

  private connect() {
    console.log('CON', this.uri);
    this.socket = new WebSocket(this.uri);
    this.bindEvents(this.socket);
  }

  bindEvents(socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      this.dispatchEvent(new MessageEvent('message', { data: event.data }));
    });
    socket.addEventListener('open', (event) => {
      this.reconnectAttempts = 0;
      this.dispatchEvent(new CustomEvent('connected'));
    });
    socket.addEventListener('error', (event) => {
      console.error(event);
      this.dispatchEvent(event);
    });
    socket.addEventListener('close', (event) => {
      this.dispatchEvent(
        new CloseEvent('close', {
          code: event.code,
        }),
      );
      this.socket = undefined;
      if (!event.wasClean || shouldReconnectOnCode(event.code)) {
        this.scheduleReconnect();
      } else {
        console.log('Clean close — no reconnect');
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

    console.log(
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
      console.log('send', message);
      this.socket.send(message);
    } else {
      console.warn('WebSocket not open: ' + this.socket.readyState);
    }
  }
}
