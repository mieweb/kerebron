declare const __KEREBRON_VERSION__: string | undefined;

/** Kerebron version: release tag in npm builds, `git describe` in Vite builds, otherwise `dev`. */
export const VERSION: string = typeof __KEREBRON_VERSION__ === 'string'
  ? __KEREBRON_VERSION__
  : 'dev';
