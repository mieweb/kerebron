import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { Tracker } from 'meteor/tracker';

import * as Y from 'yjs' // eslint-disable-line
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import * as authProtocol from 'y-protocols/auth'
import * as awarenessProtocol from 'y-protocols/awareness'
import { ObservableV2 } from 'lib0/observable'

export const messageSync = 0
export const messageQueryAwareness = 3
export const messageAwareness = 1
export const messageAuth = 2

type Handler = (encoder: encoding.Encoder, decoder: decoding.Decoder, provider: MeteorProvider, emitSynced: boolean, messageType: number) => void;

interface EVENTS {
  'connection-close': (event: CloseEvent | null,  provider: MeteorProvider) => any,
  'status': (event: { status: 'connected' | 'disconnected' | 'connecting' }) => any,
  'connection-error': (event: Event, provider: MeteorProvider) => any,
  'sync': (state: boolean) => any,
  'synced': (state: boolean) => any
}

export class MeteorProvider extends ObservableV2<EVENTS> {
  private awareness: awarenessProtocol.Awareness;
  private messageHandlers: Handler[];
  private _synced: boolean;
  private _updateHandler: (update: Uint8Array, origin: any) => void;
  private _awarenessUpdateHandler: ({added, updated, removed}: {
    added: any;
    updated: any;
    removed: any
  }, _origin) => void;
  private handle: Meteor.LiveQueryHandle;
  private wsconnected: boolean;
  private _exitHandler: () => void;

  constructor(private roomId: string,
              private doc: Y.Doc,
              private collectionName: string,
              private collection: Mongo.Collection<Document, Document>) {
    super();

    const awareness = this.awareness = new awarenessProtocol.Awareness(doc);
    this.setupMessageHandlers();

    this._synced = false;

    this._updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== this) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        this.broadcastMessage(encoding.toUint8Array(encoder));
      }
    }
    this.doc.on('update', this._updateHandler);

    this._awarenessUpdateHandler = ({ added, updated, removed }, _origin) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      );
      this.broadcastMessage(encoding.toUint8Array(encoder));
    }

    this._exitHandler = () => {
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        [doc.clientID],
        'app closed'
      );
    }

    this.awareness.on('update', this._awarenessUpdateHandler)
    this.connect();

    this.joinRoom(this.roomId, (msg) => {
      const encoder = this.readMessage(new Uint8Array(msg.text), true);
      if (encoding.length(encoder) > 1) {
        this.broadcastMessage(encoding.toUint8Array(encoder));
      }
    });
  }

  joinRoom(roomId: string, onMessage) {
    Meteor.subscribe(this.collectionName, roomId, {
      onReady() {
        console.log(`Subscribed to ${roomId}`);
      }
    });

    this.handle = this.collection.find().observeChanges({
      added(id, fields) {
        // console.log(`Got message from user ${fields.userId}:`, fields);
        onMessage({ _id: id, ...fields });
        // Optional: remove the message immediately so it doesn't pile up
        // this.collection.remove(id);
      }
    });

    return () => this.handle.stop(); // to unsubscribe from handler later
  }

  broadcastMessage(buf: ArrayBuffer) {
    if (this.wsconnected) {
      Meteor.call(this.collectionName + 'SendMessage', this.roomId, buf);
    }
  }

  get synced () {
    return this._synced;
  }

  set synced (state) {
    if (this._synced !== state) {
      this._synced = state;
      this.emit('synced', [state]);
      this.emit('sync', [state]);
    }
  }

  destroy() {
    this.disconnect();
    this.awareness.off('update', this._awarenessUpdateHandler);
    this.doc.off('update', this._updateHandler);
    super.destroy();
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

    this.emit('status', [{
      status: 'connecting'
    }]);

    Tracker.autorun(() => {
      const status = Meteor.status();
      console.log('🔌 Connection status changed:', status.status);

      switch (status.status) {
        // 'connecting' | 'failed' | 'waiting'
        case 'connected':
          this.wsconnected = true;
          this.emit('status', [{
            status: 'connected'
          }]);
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
                this.doc.clientID
              ])
            );
            this.broadcastMessage(encoding.toUint8Array(encoderAwarenessState));
          }
          break;
        case 'offline':
          this.closeWebsocketConnection(null);
          break;
      }
    });
  }

  closeWebsocketConnection(event: CloseEvent | null) {
    this.emit('connection-close', [event, this]);

    if (this.wsconnected) {
      this.wsconnected = false;
      this.synced = false;
      // update awareness (all users except local left)
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        Array.from(this.awareness.getStates().keys()).filter((client) =>
          client !== this.doc.clientID
        ),
        this
      );
      this.emit('status', [{
        status: 'disconnected'
      }]);
    }
  }

  private setupMessageHandlers() {
    this.messageHandlers = [];
    this.messageHandlers[messageSync] = (
      encoder,
      decoder,
      provider,
      emitSynced,
      _messageType
    ) => {
      encoding.writeVarUint(encoder, messageSync);
      const syncMessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        provider.doc,
        provider
      );
      if (
        emitSynced && syncMessageType === syncProtocol.messageYjsSyncStep2 &&
        !provider.synced
      ) {
        provider.synced = true
      }
    }

    this.messageHandlers[messageQueryAwareness] = (
      encoder,
      _decoder,
      provider,
      _emitSynced,
      _messageType
    ) => {
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          provider.awareness,
          Array.from(provider.awareness.getStates().keys())
        )
      );
    }

    this.messageHandlers[messageAwareness] = (
      _encoder,
      decoder,
      provider,
      _emitSynced,
      _messageType
    ) => {
      awarenessProtocol.applyAwarenessUpdate(
        provider.awareness,
        decoding.readVarUint8Array(decoder),
        provider
      );
    }

    const permissionDeniedHandler = (provider: MeteorProvider, reason) =>
      console.warn(`Permission denied to access ${provider.roomId}.\n${reason}`);

    this.messageHandlers[messageAuth] = (
      _encoder,
      decoder,
      provider,
      _emitSynced,
      _messageType
    ) => {
      authProtocol.readAuthMessage(
        decoder,
        provider.doc,
        (_ydoc, reason) => permissionDeniedHandler(provider, reason)
      );
    }
  }
}
