import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // fastest React plugin in 2025
import wasm from 'vite-plugin-wasm';
import { deno } from '../../build/vite-plugins/denoPlugin.ts';
import { generateAlias } from '../../build/vite-plugins/generateAlias.ts';

export default defineConfig({
  base: '',
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
  },
  clearScreen: false,
});
