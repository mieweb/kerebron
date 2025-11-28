/**
 * Compatibility shim for deno_tree_sitter -> web-tree-sitter
 * This provides the same createParser API that deno_tree_sitter exports
 */
import Parser from 'web-tree-sitter';

let initialized = false;

/**
 * Creates a tree-sitter parser from WASM binary data.
 * Compatible with deno_tree_sitter's createParser API.
 *
 * @param wasmBinary - The WASM binary data (Uint8Array or ArrayBuffer)
 * @returns A configured Parser instance with the language set
 */
export async function createParser(
  wasmBinary: Uint8Array | ArrayBuffer,
): Promise<Parser> {
  if (!initialized) {
    await Parser.init();
    initialized = true;
  }

  const parser = new Parser();
  const language = await Parser.Language.load(wasmBinary);
  parser.setLanguage(language);

  return parser;
}

// Re-export other items from main.js for compatibility
export { Parser };
