import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { deno } from '../../build/vite-plugins/denoPlugin.ts';
import { generateAlias } from '../../build/vite-plugins/generateAlias.ts';

export default defineConfig({
  base: '',
  appType: 'mpa',
  plugins: [
    wasm(),
    deno(),
  ],
  css: {
    modules: {},
  },
  resolve: {
    alias: generateAlias(),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  clearScreen: false,
});
