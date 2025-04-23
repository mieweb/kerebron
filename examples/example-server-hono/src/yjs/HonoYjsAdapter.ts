import { WSContext, WSEvents } from 'hono/ws';

import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const messageSync = 0;
const messageAwareness = 1;
// const messageAuth = 2

export const docs: Map<string, Y.Doc> = new Map();

const gcEnabled = false;

/**
 * Gets a Y.Doc by name, whether in memory or on disk
 *
 * @param {string} docname - the name of the Y.Doc to find or create
 * @param {boolean} gc - whether to allow gc on the doc (applies only when created)
 * @return {WSSharedDoc}
 */
export const getYDoc = (docname: string, gc = true): Y.Doc => {
  if (docs.has(docname)) {
    return docs.get(docname);
  }
  const doc = new Y.Doc({ gc: gcEnabled });
  doc.gc = gc;
  // if (persistence !== null) {
  //   persistence.bindState(docname, doc)
  // }
  docs.set(docname, doc);
  return doc;
};

export class SocketContext {
  public readonly controlledIds: Set<number> = new Set();

  constructor(public readonly room: Room, public readonly socket: WebSocket) {
  }
}

export class Room {
  public readonly socketContexts: Map<WebSocket, SocketContext> = new Map();
  awareness: awarenessProtocol.Awareness;

  constructor(public readonly roomName: string, public readonly doc: Y.Doc) {
    this.awareness = new awarenessProtocol.Awareness(doc);
    this.awareness.setLocalState(null);
    this.awareness.on(
      'update',
      (
        { added, updated, removed }: {
          added: number[];
          updated: number[];
          removed: number[];
        },
        conn: WebSocket,
      ) => {
        const changedClients = added.concat(updated, removed);
        if (conn !== null) {
          const socketContext = this.socketContexts.get(conn);
          if (socketContext) {
            added.forEach((clientID) => {
              socketContext.controlledIds.add(clientID);
            });
            removed.forEach((clientID) => {
              socketContext.controlledIds.delete(clientID);
            });
          }
        }
        // broadcast awareness update
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(
            this.awareness,
            changedClients,
          ),
        );
        const buff = encoding.toUint8Array(encoder);
        for (const socket of this.socketContexts.keys()) {
          socket.send(buff);
        }
      },
    );

    doc.on(
      'update',
      (update) => {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        const message = encoding.toUint8Array(encoder);
        for (const socket of this.socketContexts.keys()) {
          socket.send(message);
        }
      },
    );
  }
}

const rooms: Map<string, Room> = new Map();
export async function getRoomNames() {
  return Array.from(rooms.keys());
}

export class HonoYjsAdapter {
  readonly sockets: Map<WebSocket, SocketContext> = new Map();
  readonly rooms: Map<string, Room>;

  constructor() {
    this.rooms = rooms;
  }

  upgradeWebSocket(roomName: string): WSEvents<WebSocket> {
    const doc = getYDoc(roomName, gcEnabled);

    return {
      onOpen: (evt: Event, wsContext: WSContext<WebSocket>) => {
        if (!wsContext.raw) {
          return;
        }

        if (!this.rooms.has(roomName)) {
          this.rooms.set(roomName, new Room(roomName, doc));
        }
        const room = this.rooms.get(roomName)!;

        const socketContext = new SocketContext(room, wsContext.raw);
        this.sockets.set(wsContext.raw, socketContext);
        room.socketContexts.set(wsContext.raw, socketContext);

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeSyncStep1(encoder, doc);
        this.send(wsContext.raw, encoding.toUint8Array(encoder));
        const awarenessStates = room.awareness.getStates();
        if (awarenessStates.size > 0) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(
              room.awareness,
              Array.from(awarenessStates.keys()),
            ),
          );
          this.send(wsContext.raw, encoding.toUint8Array(encoder));
        }
        // this.#forceReady();
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

  send(conn: WebSocket, m: Uint8Array) {
    if (
      conn.readyState !== WebSocket.CONNECTING &&
      conn.readyState !== WebSocket.OPEN
    ) {
      this.#terminate(conn);
    }
    conn.send(m);
  }

  receiveMessage(messageBytes: Uint8Array, conn: WebSocket) {
    try {
      const socketContext = this.sockets.get(conn);
      if (!socketContext) {
        return;
      }

      const room = socketContext.room;

      const encoder = encoding.createEncoder();
      const decoder = decoding.createDecoder(messageBytes);
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case messageSync:
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn);

          // If the `encoder` only contains the type of reply message and no
          // message, there is no need to send the message. When `encoder` only
          // contains the type of reply, its length is 1.
          if (encoding.length(encoder) > 1) {
            this.send(conn, encoding.toUint8Array(encoder));
          }
          break;
        case messageAwareness: {
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            decoding.readVarUint8Array(decoder),
            conn,
          );
          break;
        }
      }
    } catch (err) {
      console.error(err);
      // @ts-ignore
      doc.emit('error', [err]);
    }
  }

  #terminate(socket: WebSocket) {
    this.#removeSocket(socket);
    socket.close();
  }

  #removeSocket(conn: WebSocket) {
    const socketContext = this.sockets.get(conn);
    if (socketContext) {
      const room = socketContext.room;
      room.socketContexts.delete(socketContext.socket);
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        Array.from(socketContext.controlledIds),
        null,
      );

      if (room.socketContexts.size === 0) {
        // TODO save to persistence
        // TODO Destroy room
      }
      this.sockets.delete(conn);
    }
  }
}
