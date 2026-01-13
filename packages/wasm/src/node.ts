import { resolve } from 'node:path';

const __dirname = import.meta.dirname;

export function nodeCdn() {
  const realDirName = __dirname?.split('::').pop();
  return 'file://' + resolve(realDirName, '../assets');
}
