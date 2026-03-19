// y-websocket is forked because we need better state connection handling

import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

export const messageSync = 0;
export const messageQueryAwareness = 3;
export const messageAwareness = 1;
export const messageAuth = 2;

export type CreateYjsProvider = (roomId: string) => [YjsProvider, Y.Doc];

export const MessageType = {
  Sync: 0,
  Awareness: 1,
  Auth: 2,
  QueryAwareness: 3,
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

export type MessageHandler<T extends YjsProvider> = (
  encoder: encoding.Encoder,
  decoder: decoding.Decoder,
  provider: T,
  emitSynced: boolean,
  messageType: MessageType,
) => void;

export interface YjsProviderEventMap {
  status: CustomEvent<{ status: 'connected' | 'disconnected' | 'connecting' }>;
  sync: CustomEvent<{ state: boolean }>;
  synced: CustomEvent<{ state: boolean }>;
  'connection-error': CustomEvent<{ event: Event; provider: YjsProvider }>;
  'connection-close': CustomEvent<
    { event: CloseEvent | null; provider: YjsProvider }
  >;
}

export interface YjsProvider extends EventTarget {
  awareness: awarenessProtocol.Awareness;
  doc: Y.Doc;
  synced: boolean;

  destroy();

  addEventListener<K extends keyof YjsProviderEventMap>(
    type: K,
    listener: (event: YjsProviderEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener<K extends keyof YjsProviderEventMap>(
    type: K,
    listener: (event: YjsProviderEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;

  dispatchEvent(event: Event): boolean;

  // fallback DOM signature (required)
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
}
