import { defineConfig } from 'vite';
import ssg from '@hono/vite-ssg';
import { defaultPlugin, SSGPlugin } from 'hono/ssg';
import { deno } from '../../build/vite-plugins/denoPlugin.ts';
import { generateAlias } from '../../build/vite-plugins/generateAlias.ts';

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

export default defineConfig({
  base: '',
  plugins: [
    ssg({
      entry: './src/honoSSG.ts',
      plugins: [defaultPlugin, skipApiPlugin],
    }),
    // wasm(),
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
