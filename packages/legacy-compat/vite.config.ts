import path from 'node:path';
import fs from 'node:fs';

import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

import { generateAlias } from '../../build/vite-plugins/generateAlias.ts';
import { deno } from '../../build/vite-plugins/denoPlugin.ts';

const __dirname = import.meta.dirname!;

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
      formats: ['es', 'cjs'],
      fileName: 'kerebron',
    },
    rollupOptions: {
      input: {
        mod: __dirname + '/mod.ts',
        auto: __dirname + '/kerebron-auto.css',
        light: __dirname + '/kerebron-light.css',
      },
      plugins: [
        {
          name: 'rename-file-after-build',
          closeBundle() {
            const distDir = path.resolve(__dirname, 'dist');
            fs.renameSync(
              path.join(distDir, 'kerebron3.js'),
              path.join(distDir, 'kerebron.js'),
            );
            fs.renameSync(
              path.join(distDir, 'kerebron3.cjs'),
              path.join(distDir, 'kerebron.cjs'),
            );
          },
        },
      ],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'auto.css') {
            return 'kerebron.css';
          }
          if (assetInfo.name === 'light.css') {
            return 'kerebron-light.css';
          }
          return assetInfo.name;
        },
      },
    },
  },
  clearScreen: false,
});
