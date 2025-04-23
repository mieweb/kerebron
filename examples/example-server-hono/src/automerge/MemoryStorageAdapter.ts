import {
  Chunk,
  StorageAdapterInterface,
  type StorageKey,
} from '@automerge/automerge-repo/slim';

export class MemoryStorageAdapter implements StorageAdapterInterface {
  private cache: { [key: string]: Uint8Array } = {};

  /**
   * @param baseDirectory - The path to the directory to store data in. Defaults to "./automerge-repo-data".
   */
  constructor() {
  }

  getKeys() {
    return Object.keys(this.cache) || [];
  }

  load(keyArray: StorageKey): Promise<Uint8Array | undefined> {
    const key = getKey(keyArray);
    if (this.cache[key]) return this.cache[key];
    // throw new Error('Not found: ' + key);
    return undefined;
  }

  save(keyArray: StorageKey, binary: Uint8Array): Promise<void> {
    const key = getKey(keyArray);
    this.cache[key] = binary;
  }

  remove(keyArray: string[]): Promise<void> {
    // remove from cache
    delete this.cache[getKey(keyArray)];
  }

  async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
    // Get the list of all cached keys that match the prefix
    const cachedKeys = this.cachedKeys(keyPrefix);

    // Combine and deduplicate the lists of keys
    const allKeys = [...new Set([...cachedKeys])];

    // Load all files
    const chunks = await Promise.all(
      allKeys.map(async (keyString) => {
        const key: StorageKey = keyString.split('-');
        const data = await this.load(key);
        return { data, key };
      }),
    );

    return chunks;
  }

  removeRange(keyPrefix: string[]): Promise<void> {
    this.cachedKeys(keyPrefix).forEach((key) => delete this.cache[key]);
  }

  private cachedKeys(keyPrefix: string[]): string[] {
    const cacheKeyPrefixString = getKey(keyPrefix);
    return Object.keys(this.cache).filter((key) =>
      key.startsWith(cacheKeyPrefixString)
    );
  }
}

const getKey = (key: StorageKey): string => key.join('-');
