import { resolve } from 'node:path';

import { type AssetLoad } from '@kerebron/editor';

const __dirname = import.meta.dirname;

export function nodeCdn() {
  const realDirName = __dirname?.split('::').pop()!;
  return 'file://' + resolve(realDirName, '../assets');
}

export const assetLoad: AssetLoad = async (name: string) => {
  const cdnUrl = nodeCdn();
  const wasmUrl = cdnUrl + '/' + name;

  const response = await fetch(wasmUrl);
  if (response.status >= 400) {
    throw new Error(`Error fetching ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
};
