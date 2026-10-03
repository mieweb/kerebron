import { Language, Parser } from 'web-tree-sitter';

let initPromise: Promise<void> | null = null;

type AssetLoad = (name: string) => Promise<Uint8Array<any>>;

interface Options {
  assetLoad: AssetLoad;
}

// Initialise the runtime once. A shared promise (not a boolean flag flipped
// before init resolves) keeps concurrent callers from constructing a Parser
// before init() completes on iOS/WKWebView.
function ensureInitialized(assetLoad: AssetLoad): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const module = {
        wasmBinary: await assetLoad('tree-sitter/web-tree-sitter.wasm'),
        // Avoid web-tree-sitter's import.meta.url fallback, which throws
        // "Invalid scheme" in an iOS Cordova WKWebView. Never fetched here
        // because wasmBinary is provided.
        locateFile(path: string) {
          return path;
        },
      };
      await Parser.init(module);
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export async function createParser(
  wasmUint8Array: Uint8Array,
  { assetLoad }: Options,
): Promise<Parser> {
  await ensureInitialized(assetLoad);
  const parser = new Parser();
  const language = await Language.load(wasmUint8Array);
  parser.setLanguage(language);
  return parser;
}
