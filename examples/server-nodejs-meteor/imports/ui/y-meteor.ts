import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { Tracker } from 'meteor/tracker';

import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as authProtocol from 'y-protocols/auth';
import * as awarenessProtocol from 'y-protocols/awareness';

import {
  MessageHandler,
  MessageType,
} from '@kerebron/extension-yjs/YjsProvider';
import {
  messageAuth,
  messageAwareness,
  messageQueryAwareness,
  messageSync,
} from '@kerebron/extension-yjs/YjsProvider';

export class MeteorProvider extends EventTarget {
  private awareness: awarenessProtocol.Awareness;
  private messageHandlers: MessageHandler<MeteorProvider>[];
  private _synced: boolean;
  private _updateHandler: (update: Uint8Array, origin: any) => void;
  private _awarenessUpdateHandler: ({ added, updated, removed }: {
    added: any;
    updated: any;
    removed: any;
  }, _origin: any) => void;
  private handle: Meteor.LiveQueryHandle;

  wsconnected = false;
  wsconnecting = false;
  bcconnected = false;

  private _exitHandler: () => void;

  constructor(
    private roomId: string,
    private doc: Y.Doc,
    private collectionName: string,
    private collection: Mongo.Collection<Document, Document>,
  ) {
    super();

    const awareness = this.awareness = new awarenessProtocol.Awareness(doc);
    this.messageHandlers = this.setupMessageHandlers();

    this._synced = false;

    this._updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== this) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        this.broadcastMessage(encoding.toUint8Array(encoder));
      }
    };
    this.doc.on('update', this._updateHandler);

    this._awarenessUpdateHandler = ({ added, updated, removed }, _origin) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients),
      );
      this.broadcastMessage(encoding.toUint8Array(encoder));
    };

    this._exitHandler = () => {
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        [doc.clientID],
        'app closed',
      );
    };

    this.awareness.on('update', this._awarenessUpdateHandler);
    this.connect();

    this.joinRoom(this.roomId, (msg) => {
      const encoder = this.readMessage(new Uint8Array(msg.text), true);
      if (encoding.length(encoder) > 1) {
        this.broadcastMessage(encoding.toUint8Array(encoder));
      }
    });
  }

  joinRoom(roomId: string, onMessage: (message: any) => void) {
    Meteor.subscribe(this.collectionName, roomId, {
      onReady() {
        console.log(`Subscribed to ${roomId}`);
      },
    });

    this.handle = this.collection.find().observeChanges({
      added(id: string, fields: any) {
        // console.log(`Got message from user ${fields.userId}:`, fields);
        onMessage({ _id: id, ...fields });
        // Optional: remove the message immediately so it doesn't pile up
        // this.collection.remove(id);
      },
    });

    return () => this.handle.stop(); // to unsubscribe from handler later
  }

  broadcastMessage(buf: ArrayBuffer) {
    if (this.wsconnected) {
      Meteor.call(this.collectionName + 'SendMessage', this.roomId, buf);
    }
  }

  get synced() {
    return this._synced;
  }

  set synced(state) {
    if (this._synced !== state) {
      this._synced = state;

      this.dispatchEvent(new CustomEvent('synced', { detail: { state } }));
      this.dispatchEvent(new CustomEvent('sync', { detail: { state } }));
    }
  }

  destroy() {
    this.disconnect();
    this.awareness.off('update', this._awarenessUpdateHandler);
    this.doc.off('update', this._updateHandler);
  }

  disconnect() {
    this.closeWebsocketConnection(null);
  }

  connect() {
    if (!this.wsconnected) {
      this.setupWS();
    }
  }

  readMessage(buf: Uint8Array, emitSynced: boolean): encoding.Encoder {
    const decoder = decoding.createDecoder(buf);
    const encoder = encoding.createEncoder();
    const messageType = decoding.readVarUint(decoder);
    const messageHandler = this.messageHandlers[messageType];
    if (messageHandler) {
      messageHandler(encoder, decoder, this, emitSynced, messageType);
    } else {
      console.error('Unable to compute message');
    }
    return encoder;
  }

  setupWS() {
    this.wsconnected = false;
    this.synced = false;

    this.dispatchEvent(
      new CustomEvent('status', { detail: { status: 'connecting' } }),
    );

    Tracker.autorun(() => {
      const status = Meteor.status();
      console.log('🔌 Connection status changed:', status.status);

      switch (status.status) {
        // 'connecting' | 'failed' | 'waiting'
        case 'connected':
          {
            this.wsconnected = true;

            this.dispatchEvent(
              new CustomEvent('status', { detail: { status: 'connected' } }),
            );
            // always send sync step 1 when connected
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            syncProtocol.writeSyncStep1(encoder, this.doc);
            this.broadcastMessage(encoding.toUint8Array(encoder));
            // broadcast local awareness state
            if (this.awareness.getLocalState() !== null) {
              const encoderAwarenessState = encoding.createEncoder();
              encoding.writeVarUint(encoderAwarenessState, messageAwareness);
              encoding.writeVarUint8Array(
                encoderAwarenessState,
                awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
                  this.doc.clientID,
                ]),
              );
              this.broadcastMessage(
                encoding.toUint8Array(encoderAwarenessState),
              );
            }
          }
          break;
        case 'offline':
          this.closeWebsocketConnection(null);
          break;
      }
    });
  }

  closeWebsocketConnection(event: CloseEvent | null) {
    this.dispatchEvent(
      new CustomEvent('connection-close', { detail: { event } }),
    );

    if (this.wsconnected) {
      this.wsconnected = false;
      this.synced = false;
      // update awareness (all users except local left)
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        Array.from(this.awareness.getStates().keys()).filter((client) =>
          client !== this.doc.clientID
        ),
        this,
      );
      this.dispatchEvent(
        new CustomEvent('status', { detail: { status: 'disconnected' } }),
      );
    }
  }

  private setupMessageHandlers() {
    const messageHandlers: MessageHandler<MeteorProvider>[] = [];
    messageHandlers[messageSync] = (
      encoder: encoding.Encoder,
      decoder: decoding.Decoder,
      provider: MeteorProvider,
      emitSynced: boolean,
      _messageType: MessageType,
    ) => {
      encoding.writeVarUint(encoder, messageSync);
      const syncMessageType = syncProtocol.readSyncMessage(
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
      provider: MeteorProvider,
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
      provider: MeteorProvider,
      _emitSynced: boolean,
      _messageType: MessageType,
    ) => {
      awarenessProtocol.applyAwarenessUpdate(
        provider.awareness,
        decoding.readVarUint8Array(decoder),
        provider,
      );
    };

    const permissionDeniedHandler = (
      provider: MeteorProvider,
      reason: string,
    ) =>
      console.warn(
        `Permission denied to access ${provider.roomId}.\n${reason}`,
      );

    messageHandlers[messageAuth] = (
      _encoder: encoding.Encoder,
      decoder: decoding.Decoder,
      provider: MeteorProvider,
      _emitSynced: boolean,
      _messageType: MessageType,
    ) => {
      authProtocol.readAuthMessage(
        decoder,
        provider.doc,
        (_ydoc: Y.Doc, reason: string) =>
          permissionDeniedHandler(provider, reason),
      );
    };

    return messageHandlers;
  }
}
