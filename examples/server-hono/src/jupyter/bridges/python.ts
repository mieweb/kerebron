import type { KernelLanguageBridge } from './types.ts';

/** Names IPython injects that are not user data. */
const PYTHON_NOISE = new Set([
  'In',
  'Out',
  'exit',
  'quit',
  'get_ipython',
  'open',
  'help',
  'copyright',
  'credits',
  'license',
]);

export const pythonBridge: KernelLanguageBridge = {
  id: 'python',
  languages: ['python'],
  namePrefixes: ['python'],
  trackSets: false,

  listVarsCode(marker) {
    return [
      'import json',
      'names = sorted(',
      '  k for k in globals()',
      '  if not k.startswith("_")',
      ')',
      `print(${JSON.stringify(marker)} + json.dumps(names))`,
    ].join('\n');
  },

  getCode(name, marker) {
    return [
      'import json',
      `print(${JSON.stringify(marker)} + json.dumps(${name}, default=str))`,
    ].join('\n');
  },

  setCode(name, jsonLiteral) {
    return [
      'import json',
      `${name} = json.loads(${JSON.stringify(jsonLiteral)})`,
      name,
    ].join('\n');
  },

  filterNames(names) {
    return names.filter((n) => !PYTHON_NOISE.has(n) && !n.startsWith('_'));
  },
};
