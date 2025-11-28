import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import wasm from 'vite-plugin-wasm';
import denoPlugin from '../../build/vite-plugins/resolvePlugin.ts';
import denoPrefixPlugin from '../../build/vite-plugins/prefixPlugin.ts';
import { DenoResolveResult } from '../../build/vite-plugins/resolver.ts';
import { denoCssPlugin } from '../../build/vite-plugins/denoCssPlugin.ts';
import { generateAlias } from '../../build/vite-plugins/generateAlias.ts';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const __dirname = import.meta.dirname!;

const cache = new Map<string, DenoResolveResult>();
export default defineConfig({
  base: '',
  // plugins: [vue(), wasm(), denoPlugin(cache), denoPrefixPlugin(cache), denoCssPlugin(__dirname + '/../../'),
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: __dirname +
            '/../../node_modules/web-tree-sitter/tree-sitter.wasm',
          dest: './.vite/deps',
        },
      ],
    }),
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
    alias: generateAlias(),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  clearScreen: false,
});
