import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';

import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { YTransactionStorageImpl } from './storage.ts';
import { WSSharedDoc } from './WSSharedDoc.ts';
import { createTypedEncoder } from './message-type.ts';

export interface RemoteDoc extends Y.Doc {
  readonly awareness: Y.Awareness;
}

export class ChatRoom extends DurableObject {
  private doc: Y.Doc = new WSSharedDoc();
  private sessions = new Map<WebSocket, () => void>();

  protected storage = new YTransactionStorageImpl({
    get: (key) => this.ctx.storage.get(key),
    list: (options) => this.ctx.storage.list(options),
    put: (key, value) => this.ctx.storage.put(key, value),
    delete: async (key) =>
      this.ctx.storage.delete(Array.isArray(key) ? key : [key]),
    transaction: (closure) => this.ctx.storage.transaction(closure),
  });

  private awarenessClients = new Set<number>();

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(() => this.onStart());
  }

  protected async onStart(): Promise<void> {
    const doc = await this.storage.getYDoc();
    Y.applyUpdate(this.doc, Y.encodeStateAsUpdate(doc));

    for (const ws of this.ctx.getWebSockets()) {
      this.registerWebSocket(ws);
    }

    this.doc.on('update', async (update) => {
      await this.storage.storeUpdate(update);
    });
    this.doc.awareness.on(
      'update',
      async ({ added, removed, updated }) => {
        for (const client of [...added, ...updated]) {
          this.awarenessClients.add(client);
        }
        for (const client of removed) {
          this.awarenessClients.delete(client);
        }
      },
    );
  }

  override async fetch(request: Request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const roomName = request.url.split('/').pop();
    const [client, server] = Object.values(new WebSocketPair());

    server.serializeAttachment({
      roomName,
      connectedAt: new Date(),
    });

    this.ctx.acceptWebSocket(server);
    this.registerWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  override async webSocketMessage(ws: WebSocket, message: ArrayBuffer) {
    const uint8View = new Uint8Array(message);
    await this.updateYDoc(uint8View);
  }

  async updateYDoc(update: Uint8Array): Promise<void> {
    this.doc.update(update);
    await this.cleanup();
  }

  protected async cleanup() {
    if (this.sessions.size < 1) {
      await this.storage.commit();
    }
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.unregisterWebSocket(ws);
    await this.cleanup();
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.unregisterWebSocket(ws);
    await this.cleanup();
  }

  protected registerWebSocket(ws: WebSocket) {
    const encoder = createTypedEncoder('sync');
    syncProtocol.writeSyncStep1(encoder, this.doc);
    ws.send(encoding.toUint8Array(encoder));

    const states = this.doc.awareness.getStates();
    if (states.size > 0) {
      const encoder = createTypedEncoder('awareness');
      const update = awarenessProtocol.encodeAwarenessUpdate(
        this.doc.awareness,
        Array.from(states.keys()),
      );
      encoding.writeVarUint8Array(encoder, update);

      ws.send(encoding.toUint8Array(encoder));
    }

    const s = this.doc.notify((message) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
    this.sessions.set(ws, s);
  }

  protected async unregisterWebSocket(ws: WebSocket) {
    try {
      const dispose = this.sessions.get(ws);
      dispose?.();
      this.sessions.delete(ws);
      const clientIds = this.awarenessClients;

      awarenessProtocol.removeAwarenessStates(
        this.doc.awareness,
        Array.from(clientIds),
        null,
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }
}
