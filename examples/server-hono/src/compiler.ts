import { resolve } from '@std/path';
import { build } from 'vite';
import { generateAlias } from '../../../utils/vite-plugins/generateAlias.ts';

const root = resolve(import.meta.dirname!, '../../..');

/**
 * Minifies a CSS file using Vite's CSS pipeline and returns the minified CSS
 * along with its sourcemap.
 *
 * CSS is passed as the sole Rollup input. `cssCodeSplit` is left at its default
 * (`true`) because Rolldown rejects CSS entries when it is `false`.
 *
 * `root` is the monorepo root so `@import '@kerebron/.../assets/*.css'` can
 * resolve through the same aliases used by the example Vite configs.
 */
export async function minifyCss(
  file: string,
): Promise<{ css: string }> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    root,
    resolve: {
      alias: generateAlias(),
    },
    build: {
      write: false,
      // sourcemap: true,
      cssMinify: true,
      rollupOptions: {
        input: file,
        output: {
          assetFileNames: '[name][extname]',
        },
      },
    },
  });

  // `build` resolves to a watcher in watch mode; here we always run a
  // one-shot build, so narrow to `RolldownOutput` via its `output` array.
  if (!('output' in result)) {
    throw new Error(`Unexpected build output for ${file}`);
  }

  const assets = result.output;

  const css = assets.find(
    (asset) =>
      asset.type === 'asset' &&
      asset.fileName.endsWith('.css') &&
      !asset.fileName.endsWith('.map'),
  );

  if (!css || css.type !== 'asset') {
    throw new Error(`No CSS output generated for ${file}`);
  }

  const map = assets.find(
    (asset) => asset.type === 'asset' && asset.fileName.endsWith('.css.map'),
  );

  // if (!map || map.type !== 'asset') {
  //   throw new Error(`No CSS sourcemap generated for ${file}`);
  // }

  return {
    css: decodeAsset(css.source),
    // map: decodeAsset(map.source),
  };
}

function decodeAsset(source: string | Uint8Array): string {
  return typeof source === 'string' ? source : new TextDecoder().decode(source);
}
