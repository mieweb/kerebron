import { type AssetLoad } from '@kerebron/editor';

export const createAssetLoad: (url: URL | string) => AssetLoad = (
  url: URL | string,
) => {
  return async (name: string) => {
    const cdnUrl = url.toString();
    const wasmUrl = cdnUrl + '/' + name;

    const response = await fetch(wasmUrl);
    if (response.status >= 400) {
      throw new Error(`Error fetching ${response.status}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  };
};
