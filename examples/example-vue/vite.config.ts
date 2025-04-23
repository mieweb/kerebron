import path from 'node:path';
import fs from 'node:fs';

import { defineConfig } from 'npm:vite';
import vue from '@vitejs/plugin-vue';
import wasm from 'npm:vite-plugin-wasm';
import { VitePluginWatchWorkspace } from './vite-plugins/VitePluginWatchWorkspace.ts';
import denoPlugin from './vite-plugins/resolvePlugin.ts';
import denoPrefixPlugin from './vite-plugins/prefixPlugin.ts';
import { DenoResolveResult } from './vite-plugins/resolver.ts';

const __dirname = import.meta.dirname;

function denoCssPlugin(workspaceRoot: string) {
  function addCssAliasesFromDenoDir(denoDirPath: string, config) {
    const content = fs.readFileSync(path.resolve(denoDirPath, 'deno.json'));
    const json = JSON.parse(new TextDecoder().decode(content));
    if (json.workspace) {
      for (const pack of json.workspace) {
        addCssAliasesFromDenoDir(path.resolve(denoDirPath, pack), config);
      }
    }
    if (json.name && json.exports) {
      const exports = 'string' === typeof json.exports
        ? { '.': json.exports }
        : json.exports;
      for (const [alias, file] of Object.entries(exports)) {
        const fullAlias = path.resolve('/', json.name, alias).substring(1);
        if (file.endsWith('.css')) {
          config.resolve.alias[fullAlias] = path.resolve(
            workspaceRoot,
            path.resolve(denoDirPath, file),
          );
        } else {
          // config.resolve.alias[fullAlias] = path.resolve(
          //   workspaceRoot,
          //   path.resolve(denoDirPath, file),
          // );
        }
      }
    }
  }

  return {
    name: 'deno-css',
    enforce: 'pre',
    config: (config) => {
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      addCssAliasesFromDenoDir(workspaceRoot, config);
    },
  };
}

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
