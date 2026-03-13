import type { Plugin } from 'vite';
import type { DenoResolveResult } from './resolver.ts';
import resolvePlugin from './resolvePlugin.ts';
import denoPrefixPlugin from './prefixPlugin.ts';
import { denoCssPlugin } from './denoCssPlugin.ts';

const __dirname = import.meta.dirname!;

// TODO: revisit https://github.com/denoland/deno-vite-plugin , maaaybeee...

export function deno(): Plugin[] {
  const cache = new Map<string, DenoResolveResult>();

  return [
    denoPrefixPlugin(cache),
    resolvePlugin(cache, __dirname + '/../../'),
    denoCssPlugin(__dirname + '/../../'),
  ];
}
