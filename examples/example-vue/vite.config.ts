import { defineConfig } from 'npm:vite';
import vue from '@vitejs/plugin-vue';
import wasm from 'npm:vite-plugin-wasm';
import { VitePluginWatchWorkspace } from './vite-plugins/VitePluginWatchWorkspace.ts';
import denoPlugin from './vite-plugins/resolvePlugin.ts';
import denoPrefixPlugin from './vite-plugins/prefixPlugin.ts';
import { DenoResolveResult } from './vite-plugins/resolver.ts';
import { denoCssPlugin } from './vite-plugins/denoCssPlugin.ts';

const __dirname = import.meta.dirname!;

const cache = new Map<string, DenoResolveResult>();
export default defineConfig({
  // plugins: [vue(), wasm(), denoPlugin(cache), denoPrefixPlugin(cache), denoCssPlugin(__dirname + '/../../'), VitePluginWatchWorkspace({
  plugins: [
    vue(),
    wasm(),
    // deno(),
    denoPrefixPlugin(cache),
    denoPlugin(cache, __dirname + '/../../'),
    denoCssPlugin(__dirname + '/../../'),
    VitePluginWatchWorkspace({
      workspaceRoot: __dirname + '/../../',
      currentPackage: __dirname,
      format: 'esm',
      fileTypes: ['ts', 'vue'],
      ignorePaths: ['node_modules', 'dist', '.deno'],
    }),
  ],
  resolve: {
    alias: {
      'punycode.js': __dirname + '/src/punycode.ts',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  clearScreen: false,
});
