import { Language, Parser } from 'web-tree-sitter';

let hasBeenLoaded = false;

type AssetLoad = (name: string) => Promise<Uint8Array<any>>;

interface Options {
  assetLoad: AssetLoad;
}

export async function createParser(
  wasmUint8Array: Uint8Array,
  { assetLoad }: Options,
): Promise<Parser> {
  if (!hasBeenLoaded) {
    hasBeenLoaded = true;
    const module = {
      wasmBinary: await assetLoad('tree-sitter/web-tree-sitter.wasm'),
    };
    await Parser.init(module);
  }
  const parser = new Parser();
  const language = await Language.load(wasmUint8Array);
  parser.setLanguage(language);
  return parser;
}
