import { AssetLoad } from '@kerebron/editor';

export function denoCdn() {
  return import.meta.resolve('../assets');
}

export const assetLoad: AssetLoad = async (name: string) => {
  const cdnUrl = denoCdn();
  const wasmUrl = cdnUrl + '/' + name;

  try {
    const response = await fetch(wasmUrl);
    if (response.status >= 400) {
      throw new Error(`Error fetching ${response.status}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  } catch (err: any) {
    throw new Error(err.message + ' ' + wasmUrl);
  }
};
