import { javascriptBridge } from './javascript.ts';
import { pythonBridge } from './python.ts';
import type { KernelLanguageBridge } from './types.ts';

export type { KernelLanguageBridge } from './types.ts';
export { javascriptBridge } from './javascript.ts';
export { pythonBridge } from './python.ts';

const BRIDGES: KernelLanguageBridge[] = [pythonBridge, javascriptBridge];

/** Best-effort language when only kernelspec name is known (e.g. custom argv). */
export function guessLanguage(kernelName: string): string {
  const name = kernelName.toLowerCase();
  if (name === 'python' || name === 'python3' || name.startsWith('python')) {
    return 'python';
  }
  if (name === 'deno' || name.startsWith('deno')) {
    return 'typescript';
  }
  return '';
}

/**
 * Resolve a language bridge from kernel_info language and/or kernelspec name.
 */
export function resolveLanguageBridge(
  language: string,
  kernelName = '',
): KernelLanguageBridge {
  const lang = language.toLowerCase();
  const name = kernelName.toLowerCase();

  for (const bridge of BRIDGES) {
    if (bridge.languages.some((l) => lang === l || lang.includes(l))) {
      return bridge;
    }
  }
  for (const bridge of BRIDGES) {
    if (bridge.namePrefixes?.some((p) => name === p || name.startsWith(p))) {
      return bridge;
    }
  }

  const hint = language || kernelName || '(unknown)';
  throw new Error(
    `no language bridge for '${hint}'. supported: ${
      BRIDGES.map((b) => b.id).join(', ')
    }`,
  );
}
