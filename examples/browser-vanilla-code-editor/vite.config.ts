import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { deno } from '../../build/vite-plugins/denoPlugin.ts';
import { generateAlias } from '../../build/vite-plugins/generateAlias.ts';

export default defineConfig({
  base: 'https://localhost:8000/examples-frame/browser-vanilla-code-editor/',
  appType: 'mpa',
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
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  clearScreen: false,
});
