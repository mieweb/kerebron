import { WSContext, WSEvents } from 'hono/ws';

import {
  cbor as cborHelpers,
  NetworkAdapter,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';
import {
  FromClientMessage,
  FromServerMessage,
  isJoinMessage,
} from './messages.ts';

import { ProtocolV1, ProtocolVersion } from './protocolVersion.ts';
import { assert } from './assert.ts';
import { toArrayBuffer } from './toArrayBuffer.ts';

const { encode, decode } = cborHelpers;
const log = console.log;

export class HonoWSServerAdapter extends NetworkAdapter {
  sockets: Set<WebSocket> = new Set();
  peers: Map<WebSocket, PeerId> = new Map();

  #ready = false;
  #readyResolver?: () => void;
  #readyPromise: Promise<void> = new Promise<void>((resolve) => {
    this.#readyResolver = resolve;
  });

  isReady() {
    return this.#ready;
  }

  whenReady() {
    return this.#readyPromise;
  }

  #forceReady() {
    if (!this.#ready) {
      this.#ready = true;
      this.#readyResolver?.();
      this.emit('ready', { network: this });
    }
  }

  upgradeWebSocket(): WSEvents<WebSocket> {
    return {
      onOpen: (evt: Event, wsContext: WSContext<WebSocket>) => {
        if (!wsContext.raw) {
          return;
        }
        this.sockets.add(wsContext.raw);
        this.#forceReady();
      },
      onError: (error, wsContext: WSContext<WebSocket>) => {
        console.error('onError', error);
      },
      onMessage: (message, wsContext: WSContext<WebSocket>) => {
        if (!wsContext.raw) {
          return;
        }
        this.receiveMessage(
          new Uint8Array(message.data as ArrayBuffer),
          wsContext.raw,
        );
      },
      onClose: (event, wsContext: WSContext<WebSocket>) => {
        if (!wsContext.raw) {
          return;
        }
        this.#removeSocket(wsContext.raw);
      },
    };
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
    this.peerId = peerId;
    this.peerMetadata = peerMetadata;
  }

  disconnect() {
    for (const socket of this.sockets) {
      this.#terminate(socket);
      this.#removeSocket(socket);
    }
  }

  send(message: FromServerMessage) {
    assert('targetId' in message && message.targetId !== undefined);
    if ('data' in message && message.data?.byteLength === 0) {
      throw new Error('Tried to send a zero-length message');
    }
    const senderId = this.peerId;
    assert(
      senderId,
      'No peerId set for the websocket example-server-hono network adapter.',
    );

    const socket = this.#socketIdByPeerId(message.targetId);

    if (!socket) {
      log(`Tried to send to disconnected peer: ${message.targetId}`);
      return;
    }

    const encoded = encode(message);
    const arrayBuf = toArrayBuffer(encoded);

    socket.send(arrayBuf);
  }

  receiveMessage(messageBytes: Uint8Array, socket: WebSocket) {
    let message: FromClientMessage;
    try {
      message = decode(messageBytes);
    } catch (e) {
      log('invalid message received, closing connection', e);
      socket.close();
      return;
    }

    const { type, senderId } = message;

    const myPeerId = this.peerId;
    assert(myPeerId);

    const documentId = 'documentId' in message ? '@' + message.documentId : '';
    const { byteLength } = messageBytes;
    log(
      `[${senderId}->${myPeerId}${documentId}] ${type} | ${byteLength} bytes`,
    );

    if (isJoinMessage(message)) {
      const { peerMetadata, supportedProtocolVersions } = message;
      const existingSocket = this.#socketIdByPeerId(senderId);
      if (existingSocket) {
        if (existingSocket.readyState === WebSocket.OPEN) {
          existingSocket.close();
        }
        this.emit('peer-disconnected', { peerId: senderId });
      }

      // Let the repo know that we have a new connection.
      this.emit('peer-candidate', { peerId: senderId, peerMetadata });
      this.peers.set(socket, senderId);

      const selectedProtocolVersion = selectProtocol(supportedProtocolVersions);
      if (selectedProtocolVersion === null) {
        this.send({
          type: 'error',
          senderId: this.peerId!,
          message: 'unsupported protocol version',
          targetId: senderId,
        });
        if (existingSocket) {
          this.#terminate(existingSocket);
        }
      } else {
        this.send({
          type: 'peer',
          senderId: this.peerId!,
          peerMetadata: this.peerMetadata!,
          selectedProtocolVersion: ProtocolV1,
          targetId: senderId,
        });
      }
    } else {
      this.emit('message', message);
    }
  }

  #terminate(socket: WebSocket) {
    this.#removeSocket(socket);
    socket.close();
  }

  #removeSocket(socket: WebSocket) {
    const peerId = this.#peerIdBySocket(socket);
    if (!peerId) return;
    this.emit('peer-disconnected', { peerId });
    this.sockets.delete(socket);
    this.peers.delete(socket);
  }

  #socketIdByPeerId = (peerId: PeerId) => {
    for (const socket of this.peers.keys()) {
      if (this.peers.get(socket) === peerId) {
        return socket;
      }
    }
    return null;
  };

  #peerIdBySocket = (socket: WebSocket) => {
    const result = this.peers.get(socket);
    return result ?? null;
  };
}

const selectProtocol = (versions?: ProtocolVersion[]) => {
  if (versions === undefined) return ProtocolV1;
  if (versions.includes(ProtocolV1)) return ProtocolV1;
  return null;
};
