import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // fastest React plugin in 2025
import wasm from 'vite-plugin-wasm';
import { deno } from '../../build/vite-plugins/denoPlugin.ts';
import { generateAlias } from '../../build/vite-plugins/generateAlias.ts';

const basePath = '/examples-frame/browser-react/';

export default defineConfig({
  base: process.env.KEREBRON_CDN_BASE
    ? `${process.env.KEREBRON_CDN_BASE.replace(/\/+$/, '')}${basePath}`
    : basePath,
  appType: 'mpa',
  plugins: [
    react(),
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
