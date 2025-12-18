import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

import { generateAlias } from '../../build/vite-plugins/generateAlias.ts';
import { deno } from '../../build/vite-plugins/denoPlugin.ts';

const SEPARATE_CSS = true;

export default defineConfig({
  base: '',
  plugins: [
    wasm(),
    deno(),
  ],
  resolve: {
    alias: generateAlias(),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    cssCodeSplit: SEPARATE_CSS,
    lib: {
      name: 'kerebron',
      entry: __dirname + '/mod.ts',
      formats: ['es'],
      fileName: 'kerebron',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'mod.css') {
            return 'kerebron.css';
          }
          return assetInfo.name;
        },
        manualChunks: () => 'everything',
      },
    },
  },
  clearScreen: false,
});
