import path from 'node:path';
import fs from 'node:fs';

import { defineConfig } from 'vite';
import ssg from '@hono/vite-ssg';

import vue from '@vitejs/plugin-vue';
// import wasm from 'vite-plugin-wasm';

import denoPlugin from '../../build/vite-plugins/resolvePlugin.ts';
import denoPrefixPlugin from '../../build/vite-plugins/prefixPlugin.ts';
import { type DenoResolveResult } from '../../build/vite-plugins/resolver.ts';
import { denoCssPlugin } from '../../build/vite-plugins/denoCssPlugin.ts';
import { generateAlias } from '../../build/vite-plugins/generateAlias.ts';
import { defaultPlugin, SSGPlugin } from 'hono/ssg';

const __dirname = import.meta.dirname!;

const skipApiPlugin: SSGPlugin = {
  beforeRequestHook: (req) => {
    if ('http://localhost/index.html' === req.url) {
      // return false;
    }
    if (req.url.indexOf('/api/') > -1) {
      return false;
    }
    return req;
  },
};

const cache = new Map<string, DenoResolveResult>();
export default defineConfig({
  base: '',
  // plugins: [vue(), wasm(), denoPlugin(cache), denoPrefixPlugin(cache), denoCssPlugin(__dirname + '/../../')
  plugins: [
    ssg({
      entry: './src/honoSSG.ts',
      plugins: [defaultPlugin, skipApiPlugin],
    }),
    // wasm(),
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
