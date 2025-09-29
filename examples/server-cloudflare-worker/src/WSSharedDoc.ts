import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import { Doc } from 'yjs';

import { createTypedEncoder, messageType } from './message-type.ts';

export type AwarenessChanges = {
  added: number[];
  updated: number[];
  removed: number[];
};

export interface RemoteDoc extends Doc {
  readonly awareness: awarenessProtocol.Awareness;
}

type Listener<T> = (message: T) => void;
type Unsubscribe = () => void;
interface Notification<T> extends RemoteDoc {
  notify(cb: Listener<T>): Unsubscribe;
}

export class WSSharedDoc extends Doc implements Notification<Uint8Array> {
  private listeners = new Set<Listener<Uint8Array>>();
  readonly awareness = new awarenessProtocol.Awareness(this);

  constructor(opts: { gc: boolean } = { gc: true }) {
    super(opts);
    this.awareness.setLocalState(null);

    this.awareness.on('update', (changes: AwarenessChanges) => {
      this.awarenessChangeHandler(changes);
    });
    this.on('update', (update: Uint8Array) => {
      this.syncMessageHandler(update);
    });
  }

  update(message: Uint8Array) {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const type = decoding.readVarUint(decoder);

    switch (type) {
      case messageType.sync: {
        encoding.writeVarUint(encoder, messageType.sync);
        syncProtocol.readSyncMessage(decoder, encoder, this, null);

        if (encoding.length(encoder) > 1) {
          this._notify(encoding.toUint8Array(encoder));
        }
        break;
      }
      case messageType.awareness: {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          null,
        );
        break;
      }
    }
  }

  notify(listener: Listener<Uint8Array>) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private syncMessageHandler(update: Uint8Array) {
    const encoder = createTypedEncoder('sync');
    syncProtocol.writeUpdate(encoder, update);

    this._notify(encoding.toUint8Array(encoder));
  }
  private awarenessChangeHandler({
    added,
    updated,
    removed,
  }: AwarenessChanges) {
    const changed = [...added, ...updated, ...removed];
    const encoder = createTypedEncoder('awareness');
    const update = awarenessProtocol.encodeAwarenessUpdate(
      this.awareness,
      changed,
      this.awareness.states,
    );
    encoding.writeVarUint8Array(encoder, update);

    this._notify(encoding.toUint8Array(encoder));
  }

  private _notify(message: Uint8Array) {
    for (const subscriber of this.listeners) {
      subscriber(message);
    }
  }
}
