import { execSync } from 'node:child_process';
import type { Plugin } from 'vite';

function gitVersion(): string {
  try {
    return execSync('git describe --tags --always --dirty', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().replace(/^v/, '');
  } catch {
    return 'dev';
  }
}

/** Defines `__KEREBRON_VERSION__` (read by `@kerebron/editor` VERSION). */
export function versionPlugin(): Plugin {
  return {
    name: 'kerebron-version',
    config: () => ({
      define: { __KEREBRON_VERSION__: JSON.stringify(gitVersion()) },
    }),
  };
}
