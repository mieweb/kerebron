import type { KernelLanguageBridge } from './types.ts';

/**
 * Deno / TypeScript / JavaScript Jupyter kernels.
 * Cell `const`/`let` are not on globalThis — set() uses globalThis + trackSets.
 */
export const javascriptBridge: KernelLanguageBridge = {
  id: 'javascript',
  languages: ['typescript', 'javascript', 'js', 'ts'],
  namePrefixes: ['deno'],
  trackSets: true,

  listVarsCode(marker) {
    return [
      'const skip = new Set([',
      '  "console","globalThis","window","self","Deno","process",',
      '  "Buffer","clearTimeout","clearInterval","setTimeout",',
      '  "setInterval","queueMicrotask","crypto","performance",',
      '  "fetch","FormData","Headers","Request","Response",',
      '  "URL","URLSearchParams","WritableStream","ReadableStream",',
      '  "TransformStream","AbortController","structuredClone",',
      '  "atob","btoa","TextEncoder","TextDecoder","navigator",',
      ']);',
      'const names = Object.keys(globalThis).filter((k) =>',
      '  !k.startsWith("_") && !skip.has(k)',
      ');',
      `console.log(${JSON.stringify(marker)} + JSON.stringify(names));`,
    ].join('\n');
  },

  getCode(name, marker) {
    return `console.log(${JSON.stringify(marker)} + JSON.stringify(${name}));`;
  },

  setCode(name, jsonLiteral) {
    return `globalThis.${name} = ${jsonLiteral}; globalThis.${name}`;
  },
};
