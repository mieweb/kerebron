export { assert, assertEquals, assertObjectMatch } from '@std/assert';

export function trimLines(args: TemplateStringsArray) {
  const lines = args[0].split('\n');
  if (!lines[0].trim()) {
    lines.shift();
  }
  if (!lines[lines.length - 1].trim()) {
    lines[lines.length - 1] = '';
  }
  return lines.join('\n');
}
