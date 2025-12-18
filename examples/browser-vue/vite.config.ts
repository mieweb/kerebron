import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import wasm from 'vite-plugin-wasm';
import { deno } from '../../build/vite-plugins/denoPlugin.ts';
import { generateAlias } from '../../build/vite-plugins/generateAlias.ts';

export default defineConfig({
  base: '',
  appType: 'mpa',
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
