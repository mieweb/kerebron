import { defineConfig } from 'npm:vite';
import vue from '@vitejs/plugin-vue';
import wasm from 'vite-plugin-wasm';
import denoPlugin from '../../build/vite-plugins/resolvePlugin.ts';
import denoPrefixPlugin from '../../build/vite-plugins/prefixPlugin.ts';
import { type DenoResolveResult } from '../../build/vite-plugins/resolver.ts';
import { denoCssPlugin } from '../../build/vite-plugins/denoCssPlugin.ts';

const __dirname = import.meta.dirname!;

const cache = new Map<string, DenoResolveResult>();
export default defineConfig({
  base: '',
  // plugins: [vue(), wasm(), denoPlugin(cache), denoPrefixPlugin(cache), denoCssPlugin(__dirname + '/../../')
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.includes('my-'),
        },
      },
    }),
    wasm(),
    // deno(),
    denoPrefixPlugin(cache),
    denoPlugin(cache, __dirname + '/../../'),
    denoCssPlugin(__dirname + '/../../'),
  ],
  resolve: {
    alias: {
      '@kerebron/editor/assets': __dirname + '/../../' +
        'packages/editor/assets',
      '@kerebron/extension-tables/assets': __dirname + '/../../' +
        'packages/extension-tables/assets',
      '@kerebron/extension-menu/assets': __dirname + '/../../' +
        'packages/extension-menu/assets',
      '@kerebron/extension-codemirror/assets': __dirname + '/../../' +
        'packages/extension-codemirror/assets',
      'punycode.js': __dirname + '/src/punycode.ts',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  clearScreen: false,
});
