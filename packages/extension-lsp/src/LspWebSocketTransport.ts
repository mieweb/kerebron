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
  private messageBuffer: string = '';
  private awesomeMode: boolean = false; // Start in standard mode, switch to awesome if server uses it

  constructor(public readonly uri: string) {
    super();
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.isConnecting) {
      console.log('[LSP Transport] Already connecting, skipping');
      return;
    }
    console.log('[LSP Transport] Connecting to', this.uri);
    this.isConnecting = true;
    this.socket?.close();
    this.awesomeMode = false; // Start in standard mode
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
    socket.addEventListener('message', async (event) => {
      let dataPreview: string;
      let dataString: string;

      if (typeof event.data === 'string') {
        dataString = event.data;
        dataPreview = event.data.substring(0, 200);
      } else if (event.data instanceof Blob) {
        dataString = await event.data.text();
        dataPreview = `[Blob ${event.data.size} bytes] ${
          dataString.substring(0, 200)
        }`;
      } else if (event.data instanceof ArrayBuffer) {
        dataString = new TextDecoder().decode(event.data);
        dataPreview = `[ArrayBuffer] ${dataString.substring(0, 200)}`;
      } else {
        dataString = String(event.data);
        dataPreview = `[${event.data.constructor.name}] ${
          dataString.substring(0, 200)
        }`;
      }

      console.log('[LSP Transport] Received WS message:', dataPreview);
      console.log(
        '[LSP Transport] Full message length:',
        dataString.length,
        'chars',
      );

      // Add to buffer
      this.messageBuffer += dataString;
      console.log(
        '[LSP Transport] Buffer now has',
        this.messageBuffer.length,
        'chars',
      );

      // Process all complete messages in the buffer
      this.processMessageBuffer();
    });
    socket.addEventListener('open', (event) => {
      console.log('[LSP Transport] WebSocket opened');
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      this.dispatchEvent(new CustomEvent('connected'));
    });
    socket.addEventListener('error', (event) => {
      console.error(event);
      this.dispatchEvent(event);
    });
    socket.addEventListener('close', (event) => {
      console.log(
        '[LSP Transport] WebSocket closed. Code:',
        event.code,
        'Clean:',
        event.wasClean,
        'Reason:',
        event.reason,
      );
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
        console.info('[LSP Transport] Clean close — no reconnect');
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

  private processMessageBuffer() {
    // Detect mode on first message from server
    if (this.messageBuffer.length > 0) {
      const trimmed = this.messageBuffer.trimStart();
      if (trimmed.startsWith('{') && !this.awesomeMode) {
        console.log(
          '[LSP Transport] Server using AWESOME mode (JSON-RPC without headers), switching client to awesome mode',
        );
        this.awesomeMode = true;
      } else if (trimmed.startsWith('Content-Length:')) {
        console.log(
          '[LSP Transport] Server using standard LSP mode (with Content-Length headers)',
        );
        // awesomeMode is already false
      }
    }

    while (true) {
      console.log(
        '[LSP Transport] Processing buffer, length:',
        this.messageBuffer.length,
        'content:',
        this.messageBuffer.substring(0, 100),
      );

      if (this.awesomeMode) {
        // AWESOME mode: Parse raw JSON without headers
        const trimmed = this.messageBuffer.trim();
        if (trimmed) {
          try {
            const message = JSON.parse(trimmed);
            console.log(
              '[LSP Transport] Parsed message (awesome mode):',
              message.method || (message.result ? 'response' : 'unknown'),
              message.id,
            );
            this.handleMessage(message, trimmed);
            this.messageBuffer = '';
          } catch (e) {
            // Not complete JSON yet, wait for more data
            console.log(
              '[LSP Transport] Incomplete JSON, waiting for more data',
            );
          }
        }
        break;
      } else {
        // Standard LSP mode: Parse with Content-Length headers
        const headerMatch = this.messageBuffer.match(
          /Content-Length: (\d+)\r\n\r\n/,
        );

        if (!headerMatch) {
          // No Content-Length header found
          console.log(
            '[LSP Transport] No Content-Length header found, waiting for more data',
          );
          break;
        }

        const contentLength = parseInt(headerMatch[1], 10);
        const headerEnd = headerMatch.index! + headerMatch[0].length;
        const messageEnd = headerEnd + contentLength;

        console.log(
          '[LSP Transport] Found Content-Length:',
          contentLength,
          'headerEnd:',
          headerEnd,
          'messageEnd:',
          messageEnd,
          'bufferLength:',
          this.messageBuffer.length,
        );

        // Check if we have the complete message
        if (this.messageBuffer.length < messageEnd) {
          console.log(
            '[LSP Transport] Incomplete message. Have:',
            this.messageBuffer.length,
            'Need:',
            messageEnd,
          );
          break;
        }

        // Extract the JSON content
        const jsonContent = this.messageBuffer.substring(headerEnd, messageEnd);

        console.log('[LSP Transport] Extracted JSON content:', jsonContent);

        try {
          const message = JSON.parse(jsonContent);
          console.log(
            '[LSP Transport] Parsed message:',
            message.method || (message.result ? 'response' : 'unknown'),
            message.id,
          );
          this.handleMessage(message, jsonContent);
        } catch (e) {
          console.error(
            '[LSP Transport] Failed to parse JSON:',
            e,
            jsonContent,
          );
        }

        // Remove processed message from buffer
        this.messageBuffer = this.messageBuffer.substring(messageEnd);
      }
    }
  }

  private handleMessage(message: any, rawData: string) {
    if (message.result && message.result.capabilities) {
      console.log(
        '[LSP Transport] Initialize response detected, dispatching ready event',
      );
      this.dispatchEvent(new Event('ready'));
    }

    // Dispatch message event with the raw data
    this.dispatchEvent(new MessageEvent('message', { data: rawData }));
  }

  send(message: string): void {
    if (!this.socket) {
      console.warn('[LSP Transport] Socket disconnected');
      return;
    }
    if (this.socket.readyState === WebSocket.OPEN) {
      let messageToSend: string;

      if (this.awesomeMode) {
        // AWESOME mode: Send raw JSON without headers
        messageToSend = message;
        console.log(
          '[LSP Transport] Sending (awesome mode):',
          message.substring(0, 200),
        );
      } else {
        // Standard LSP mode: Add Content-Length header
        const contentLength = new TextEncoder().encode(message).length;
        messageToSend = `Content-Length: ${contentLength}\r\n\r\n${message}`;
        console.log(
          '[LSP Transport] Sending (LSP mode):',
          messageToSend.substring(0, 200),
        );
      }

      this.socket.send(messageToSend);
    } else {
      console.warn(
        '[LSP Transport] WebSocket not open: ' + this.socket.readyState,
      );
    }
  }
}
