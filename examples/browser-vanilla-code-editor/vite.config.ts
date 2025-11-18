import { defineConfig } from 'npm:vite';
import wasm from 'vite-plugin-wasm';
import denoPlugin from '../../build/vite-plugins/resolvePlugin.ts';
import denoPrefixPlugin from '../../build/vite-plugins/prefixPlugin.ts';
import { type DenoResolveResult } from '../../build/vite-plugins/resolver.ts';
import { denoCssPlugin } from '../../build/vite-plugins/denoCssPlugin.ts';

const __dirname = import.meta.dirname!;

const cache = new Map<string, DenoResolveResult>();
export default defineConfig({
  base: '',
  plugins: [
    wasm(),
    // deno(),
    denoPrefixPlugin(cache),
    denoPlugin(cache, __dirname + '/../../'),
    denoCssPlugin(__dirname + '/../../'),
  ],
  resolve: {
    alias: {
      '$deno_tree_sitter': 'https://deno.land/x/deno_tree_sitter@1.0.1.2/main/',
      '@kerebron/editor/assets': __dirname + '/../../' +
        'packages/editor/assets',
      '@kerebron/extension-tables/assets': __dirname + '/../../' +
        'packages/extension-tables/assets',
      '@kerebron/extension-menu/assets': __dirname + '/../../' +
        'packages/extension-menu/assets',
      '@kerebron/extension-codemirror/assets': __dirname + '/../../' +
        'packages/extension-codemirror/assets',
      '@kerebron/extension-codejar/assets': __dirname + '/../../' +
        'packages/extension-codejar/assets',
      '@kerebron/extension-autocomplete/assets': __dirname + '/../../' +
        'packages/extension-autocomplete/assets',
      'punycode.js': __dirname + '/src/punycode.ts',
      // import punycode from 'punycode.js'
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  clearScreen: false,
});
