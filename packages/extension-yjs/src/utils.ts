import * as Y from 'yjs';
import * as sha256 from 'lib0/hash/sha256';
import * as buf from 'lib0/buffer';

const _convolute = (digest: Uint8Array) => {
  const N = 6;
  for (let i = N; i < digest.length; i++) {
    digest[i % N] = digest[i % N] ^ digest[i];
  }
  return digest.slice(0, N);
};

export const hashOfJSON = (json: any) =>
  buf.toBase64(_convolute(sha256.digest(buf.encodeAny(json))));

export const isVisible = (item: Y.Item, snapshot: Y.Snapshot) =>
  snapshot === undefined ? !item.deleted : (snapshot.sv.has(item.id.client) &&
    (snapshot.sv.get(item.id.client)!) > item.id.clock &&
    !Y.isDeleted(snapshot.ds, item.id));
