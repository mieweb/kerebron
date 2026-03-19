import * as Y from 'yjs';
import * as time from 'lib0/time';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as authProtocol from 'y-protocols/auth';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as math from 'lib0/math';
import * as url from 'lib0/url';

import {
  messageAuth,
  messageAwareness,
  MessageHandler,
  messageQueryAwareness,
  messageSync,
  MessageType,
  YjsProvider,
} from './YjsProvider.ts';

// @todo - this should depend on awareness.outdatedTime
const messageReconnectTimeout = 30000;

const permissionDeniedHandler = (provider: WebsocketProvider, reason: string) =>
  console.warn(`Permission denied to access ${provider.url}.\n${reason}`);

const readMessage = (
  provider: WebsocketProvider,
  buf: Uint8Array,
  emitSynced: boolean,
): encoding.Encoder => {
  const decoder = decoding.createDecoder(buf);
  const encoder = encoding.createEncoder();
  const messageType = decoding.readVarUint(decoder) as MessageType;
  const messageHandler = provider.messageHandlers[messageType];
  if (messageHandler) {
    messageHandler(encoder, decoder, provider, emitSynced, messageType);
  } else {
    console.error('Unable to compute message');
  }
  return encoder;
};

/**
 * Outsource this function so that a new websocket connection is created immediately.
 * I suspect that the `ws.onclose` event is not always fired if there are network issues.
 */
const closeWebsocketConnection = (
  provider: WebsocketProvider,
  ws: WebSocket,
  event: CloseEvent | null,
) => {
  if (ws === provider.ws) {
    provider.dispatchEvent(
      new CustomEvent('connection-close', { detail: { event, provider } }),
    );
    provider.ws = undefined;
    ws.close();
    provider.wsconnecting = false;
    if (provider.wsconnected) {
      provider.wsconnected = false;
      provider.synced = false;
      // update awareness (all users except local left)
      awarenessProtocol.removeAwarenessStates(
        provider.awareness,
        Array.from(provider.awareness.getStates().keys()).filter((client) =>
          client !== provider.doc.clientID
        ),
        provider,
      );
      provider.dispatchEvent(
        new CustomEvent('status', { detail: { status: 'disconnected' } }),
      );
    } else {
      provider.wsUnsuccessfulReconnects++;
    }
    // Start with no reconnect timeout and increase timeout by
    // using exponential backoff starting with 100ms
    if (!provider.destroyed) {
      provider.setupWSTimeout = setTimeout(
        setupWS,
        math.min(
          math.pow(2, provider.wsUnsuccessfulReconnects) * 100,
          provider.maxBackoffTime,
        ),
        provider,
      );
    }
  }
};

const setupWS = (provider: WebsocketProvider) => {
  provider.setupWSTimeout = undefined;
  if (provider.shouldConnect && !provider.ws) {
    const websocket = new provider._WS(provider.url, provider.protocols);
    websocket.binaryType = 'arraybuffer';
    provider.ws = websocket;
    provider.wsconnecting = true;
    provider.wsconnected = false;
    provider.synced = false;

    websocket.onmessage = (event) => {
      provider.wsLastMessageReceived = time.getUnixTime();
      const encoder = readMessage(provider, new Uint8Array(event.data), true);
      if (encoding.length(encoder) > 1) {
        websocket.send(encoding.toUint8Array(encoder));
      }
    };
    websocket.onerror = (event) => {
      provider.dispatchEvent(
        new CustomEvent('connection-error', { detail: { event, provider } }),
      );
    };
    websocket.onclose = (event) => {
      try {
        closeWebsocketConnection(provider, websocket, event);
      } catch (err) {
        console.error(err);
      }
    };
    websocket.onopen = () => {
      provider.wsLastMessageReceived = time.getUnixTime();
      provider.wsconnecting = false;
      provider.wsconnected = true;
      provider.wsUnsuccessfulReconnects = 0;
      provider.dispatchEvent(
        new CustomEvent('status', { detail: { status: 'connected' } }),
      );
      // always send sync step 1 when connected
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, provider.doc);
      websocket.send(encoding.toUint8Array(encoder));
      // broadcast local awareness state
      if (provider.awareness.getLocalState() !== null) {
        const encoderAwarenessState = encoding.createEncoder();
        encoding.writeVarUint(encoderAwarenessState, messageAwareness);
        encoding.writeVarUint8Array(
          encoderAwarenessState,
          awarenessProtocol.encodeAwarenessUpdate(provider.awareness, [
            provider.doc.clientID,
          ]),
        );
        websocket.send(encoding.toUint8Array(encoderAwarenessState));
      }
    };
    provider.dispatchEvent(
      new CustomEvent('status', { detail: { status: 'connecting' } }),
    );
  }
};

const broadcastMessage = (provider: WebsocketProvider, buf: Uint8Array) => {
  const ws = provider.ws;
  if (provider.wsconnected && ws && ws.readyState === ws.OPEN) {
    ws.send(buf);
  }
  if (provider.bcconnected) {
    try {
      provider.bc.postMessage(buf);
    } catch (err) {
      console.trace(err);
    }
  }
};

interface WebsocketProviderOpts {
  connect: boolean;
  awareness: awarenessProtocol.Awareness;
  params: Record<string, string>; // specify url parameters
  protocols: Array<string>; // specify websocket protocols
  WebSocketPolyfill: typeof WebSocket; // Optionall provide a WebSocket polyfill
  resyncInterval: number; // Request server state every `resyncInterval` milliseconds
  maxBackoffTime: number; // Maximum amount of time to wait before trying to reconnect (we try to reconnect using exponential backoff)
  disableBc: boolean; // Disable cross-tab BroadcastChannel communication
}

/**
 * Websocket Provider for Yjs. Creates a websocket connection to sync the shared document.
 * The document name is attached to the provided url. I.e. the following example
 * creates a websocket connection to http://localhost:1234/my-document-name
 *
 * @example
 *   import * as Y from 'yjs'
 *   import { WebsocketProvider } from '@kerebron/extension-yjs/WebsocketProvider'
 *   const doc = new Y.Doc()
 *   const provider = new WebsocketProvider('http://localhost:1234', 'my-document-name', doc)
 */
export class WebsocketProvider extends EventTarget implements YjsProvider {
  roomname: string;
  doc: Y.Doc;

  _synced = false;
  shouldConnect: boolean;
  ws: WebSocket | undefined;
  _resyncInterval = 0;
  serverUrl: string;
  bcChannel: string;
  maxBackoffTime: number;
  /**
   * The specified url parameters. This can be safely updated. The changed parameters will be used
   * when a new connection is established.
   */
  params: Record<string, string>;
  protocols: string[];
  _WS: typeof WebSocket;
  awareness: awarenessProtocol.Awareness;
  destroyed = false;
  wsconnected = false;
  wsconnecting = false;
  bcconnected = false;
  disableBc: boolean;
  wsUnsuccessfulReconnects: number;
  messageHandlers: MessageHandler<WebsocketProvider>[];
  wsLastMessageReceived: number;
  public readonly bc: BroadcastChannel;
  private _bcSubscriber: (messageEvent: MessageEvent) => void;
  private _updateHandler: (update: any, origin: any) => void;
  private _awarenessUpdateHandler: (
    { added, updated, removed }: { added: any; updated: any; removed: any },
    _origin: any,
  ) => void;
  private _exitHandler: () => void;
  private _checkInterval: number;
  setupWSTimeout: number | undefined;

  constructor(
    serverUrl: string,
    roomname: string,
    doc: Y.Doc,
    opts: WebsocketProviderOpts = {
      connect: true,
      awareness: new awarenessProtocol.Awareness(doc),
      params: {},
      protocols: [],
      WebSocketPolyfill: WebSocket,
      resyncInterval: -1,
      maxBackoffTime: 2500,
      disableBc: false,
    },
  ) {
    super();
    // ensure that serverUrl does not end with /
    this.serverUrl = serverUrl;
    this.roomname = roomname;
    this.doc = doc;

    while (this.serverUrl[this.serverUrl.length - 1] === '/') {
      this.serverUrl = this.serverUrl.slice(0, this.serverUrl.length - 1);
    }
    this.bcChannel = this.serverUrl + '/' + roomname;
    this.bc = new BroadcastChannel(this.bcChannel);
    this.maxBackoffTime = opts.maxBackoffTime;
    this.params = opts.params;
    this.protocols = opts.protocols;
    this._WS = opts.WebSocketPolyfill;
    this.awareness = opts.awareness;
    this.disableBc = opts.disableBc;
    this.wsUnsuccessfulReconnects = 0;
    this.messageHandlers = this.setupMessageHandlers();
    this.wsLastMessageReceived = 0;
    this.shouldConnect = opts.connect;

    if (opts.resyncInterval > 0) {
      this._resyncInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // resend sync step 1
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.writeSyncStep1(encoder, doc);
          this.ws.send(encoding.toUint8Array(encoder));
        }
      }, opts.resyncInterval);
    }

    this._bcSubscriber = (event: MessageEvent) => {
      readMessage(this, new Uint8Array(event.data), false);
    };
    /**
     * Listens to Yjs updates and sends them to remote peers (ws and broadcastchannel)
     */
    this._updateHandler = (update, origin) => {
      if (origin !== this) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        broadcastMessage(this, encoding.toUint8Array(encoder));
      }
    };
    this.doc.on('update', this._updateHandler);
    this._awarenessUpdateHandler = ({ added, updated, removed }, _origin) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(opts.awareness, changedClients),
      );
      broadcastMessage(this, encoding.toUint8Array(encoder));
    };
    this._exitHandler = () => {
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        [doc.clientID],
        'app closed',
      );
    };
    // if (env.isNode && typeof process !== 'undefined') {
    //   process.on('exit', this._exitHandler);
    // }
    opts.awareness.on('update', this._awarenessUpdateHandler);
    this._checkInterval = /** @type {any} */ (setInterval(() => {
      try {
        if (
          this.wsconnected &&
          messageReconnectTimeout <
            time.getUnixTime() - this.wsLastMessageReceived
        ) {
          // no message received in a long time - not even your own awareness
          // updates (which are updated every 15 seconds)

          if (this.ws) {
            closeWebsocketConnection(
              this,
              this.ws,
              null,
            );
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, messageReconnectTimeout / 10));

    if (opts.connect) {
      this.connect();
    }
  }

  get url() {
    const encodedParams = url.encodeQueryParams(this.params);
    return this.serverUrl + '/' + this.roomname +
      (encodedParams.length === 0 ? '' : '?' + encodedParams);
  }

  get synced(): boolean {
    return this._synced;
  }

  set synced(state: boolean) {
    if (this._synced !== state) {
      this._synced = state;
      this.dispatchEvent(new CustomEvent('synced', { detail: { state } }));
      this.dispatchEvent(new CustomEvent('sync', { detail: { state } }));
    }
  }

  destroy() {
    this.destroyed = true;

    if (this._resyncInterval !== 0) {
      clearInterval(this._resyncInterval);
    }
    if (this.setupWSTimeout) {
      clearTimeout(this.setupWSTimeout);
    }
    clearInterval(this._checkInterval);
    this.disconnect();
    // if (env.isNode && typeof process !== 'undefined') {
    //   process.off('exit', this._exitHandler);
    // }
    this.awareness.off('update', this._awarenessUpdateHandler);
    this.doc.off('update', this._updateHandler);
    this.awareness.destroy();
  }

  connectBc() {
    if (this.disableBc) {
      return;
    }
    if (!this.bcconnected) {
      this.bc.addEventListener('message', this._bcSubscriber);
      this.bcconnected = true;
    }

    try {
      // send sync step1 to bc
      // write sync step 1
      const encoderSync = encoding.createEncoder();
      encoding.writeVarUint(encoderSync, messageSync);
      syncProtocol.writeSyncStep1(encoderSync, this.doc);
      this.bc.postMessage(encoding.toUint8Array(encoderSync));

      // broadcast local state
      const encoderState = encoding.createEncoder();
      encoding.writeVarUint(encoderState, messageSync);
      syncProtocol.writeSyncStep2(encoderState, this.doc);
      this.bc.postMessage(encoding.toUint8Array(encoderState));
      // write queryAwareness
      const encoderAwarenessQuery = encoding.createEncoder();
      encoding.writeVarUint(encoderAwarenessQuery, messageQueryAwareness);
      this.bc.postMessage(encoding.toUint8Array(encoderAwarenessQuery));
      // broadcast local awareness state
      const encoderAwarenessState = encoding.createEncoder();
      encoding.writeVarUint(encoderAwarenessState, messageAwareness);
      encoding.writeVarUint8Array(
        encoderAwarenessState,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
          this.doc.clientID,
        ]),
      );
      this.bc.postMessage(encoding.toUint8Array(encoderAwarenessState));
    } catch (err) {
      console.trace(err);
    }
  }

  disconnectBc() {
    // broadcast message with local awareness state set to null (indicating disconnect)
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
        this.doc.clientID,
      ], new Map()),
    );
    broadcastMessage(this, encoding.toUint8Array(encoder));
    if (this.bcconnected) {
      setTimeout(() => { // Deno defers sending message. Ensure above broadcase was transmitted
        try {
          this.bc.close();
        } catch (err) {
          console.trace(err);
        }
      }, 0);
      this.bcconnected = false;
    }
  }

  disconnect() {
    this.shouldConnect = false;
    this.disconnectBc();
    if (this.ws) {
      closeWebsocketConnection(this, this.ws, null);
    }
  }

  connect() {
    this.shouldConnect = true;
    if (!this.wsconnected && !this.ws) {
      setupWS(this);
      this.connectBc();
    }
  }

  private setupMessageHandlers() {
    const messageHandlers: MessageHandler<WebsocketProvider>[] = [];
    messageHandlers[messageSync] = (
      encoder: encoding.Encoder,
      decoder: decoding.Decoder,
      provider: WebsocketProvider,
      emitSynced: boolean,
      _messageType: MessageType,
    ) => {
      encoding.writeVarUint(encoder, messageSync);
      const syncMessageType: MessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        provider.doc,
        provider,
      );
      if (
        emitSynced && syncMessageType === syncProtocol.messageYjsSyncStep2 &&
        !provider.synced
      ) {
        provider.synced = true;
      }
    };

    messageHandlers[messageQueryAwareness] = (
      encoder: encoding.Encoder,
      _decoder: decoding.Decoder,
      provider: WebsocketProvider,
      _emitSynced: boolean,
      _messageType: MessageType,
    ) => {
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          provider.awareness,
          Array.from(provider.awareness.getStates().keys()),
        ),
      );
    };

    messageHandlers[messageAwareness] = (
      _encoder: encoding.Encoder,
      decoder: decoding.Decoder,
      provider: WebsocketProvider,
      _emitSynced: boolean,
      _messageType: MessageType,
    ) => {
      awarenessProtocol.applyAwarenessUpdate(
        provider.awareness,
        decoding.readVarUint8Array(decoder),
        provider,
      );
    };

    messageHandlers[messageAuth] = (
      _encoder: encoding.Encoder,
      decoder: decoding.Decoder,
      provider: WebsocketProvider,
      _emitSynced: boolean,
      _messageType: MessageType,
    ) => {
      authProtocol.readAuthMessage(
        decoder,
        provider.doc,
        (_ydoc, reason) => permissionDeniedHandler(provider, reason),
      );
    };

    return messageHandlers;
  }
}
