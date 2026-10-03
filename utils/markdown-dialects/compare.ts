/**
 * Compares Kerebron's Markdown handling with GFM (micromark), Marked and Pandoc.
 *
 *   deno task markdown:dialects              regenerate the results in docs/markdown-dialects.md
 *   deno task markdown:dialects --md '~x~'   compare one snippet in the terminal
 *
 * Requires `pandoc` on PATH.
 */
import { CoreEditor } from '@kerebron/editor';
import { assetLoad } from '@kerebron/wasm/deno';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { marked } from 'npm:marked@16.4.2';
import { micromark } from 'npm:micromark@4.0.2';
import { gfm, gfmHtml } from 'npm:micromark-extension-gfm@3.0.0';

import { type DialectCase, groups } from './cases.ts';

const LIBRARY_VERSIONS =
  'marked 16.4.2, micromark 4.0.2 + micromark-extension-gfm 3.0.0';
const DOC_URL = new URL('../../docs/markdown-dialects.md', import.meta.url);
const RESULTS_START = '<!-- results:start -->';
const RESULTS_END = '<!-- results:end -->';
const MAX_CELL = 60;

const REFERENCES = {
  gfm: 'GFM',
  marked: 'Marked',
  pandocGfm: 'Pandoc GFM',
  pandoc: 'Pandoc',
} as const;
type Reference = keyof typeof REFERENCES;

interface Result extends DialectCase {
  kerebron: string;
  saved: string;
  stable: boolean;
  refs: Record<Reference, string>;
}

// --- normalization: compare content, not each renderer's markup style ---

const TAG_ALIASES: Record<string, string> = {
  strike: 'del',
  s: 'del',
  b: 'strong',
  i: 'em',
};
const DROPPED_TAGS = new Set([
  'p',
  'div',
  'span',
  'label',
  'thead',
  'tbody',
  'figure',
  'figcaption',
  'section',
]);
const KEPT_ATTRS = new Set(['href', 'src', 'alt', 'title', 'start']);
const INLINE_MARKS = new Set([
  'em',
  'strong',
  'del',
  'sub',
  'sup',
  'mark',
  'u',
  'code',
]);
const BLOCK_TAGS =
  'ul|ol|li|table|tr|td|th|blockquote|h[1-6]|hr|br|pre|dl|dt|dd';
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  copy: '©',
  nbsp: ' ',
};

function keptAttrs(attrs: string): string {
  let out = '';
  for (
    const [, key, value = ''] of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)
  ) {
    const align = key === 'style' && value.match(/text-align:\s*(\w+)/)?.[1];
    if (align || key === 'align') out += ` align="${align || value}"`;
    else if (key === 'checked') out += ' checked';
    else if (KEPT_ATTRS.has(key)) {
      out += ` ${key}="${value.startsWith('#') ? '#' : value}"`;
    }
  }
  return out;
}

// `<strong><em>x</em></strong>` and `<em><strong>x</strong></em>` mean the same thing.
function sortNestedMarks(html: string): string {
  return html.replace(
    /<(\w+)><(\w+)>([^<]*)<\/\2><\/\1>/g,
    (match, outer, inner, text) =>
      INLINE_MARKS.has(outer) && INLINE_MARKS.has(inner) && inner < outer
        ? `<${inner}><${outer}>${text}</${outer}></${inner}>`
        : match,
  );
}

export function normalizeHtml(html: string): string {
  const normalized = html
    .replace(
      /Error: Unhandled (?:inline )?node type: (\w+)[^<]*/g,
      '⚠unhandled:$1',
    )
    .replace(/<math[\s\S]*?<\/math>/g, '<math>')
    .replace(/<wbr\s*\/?>/g, '\n')
    .replace(
      /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g,
      (_, closing, rawName, attrs) => {
        const name = TAG_ALIASES[rawName.toLowerCase()] ??
          rawName.toLowerCase();
        if (DROPPED_TAGS.has(name)) return ' ';
        return closing ? `</${name}>` : `<${name}${keptAttrs(attrs)}>`;
      },
    )
    .replace(/<a[^>]*><\/a>|<\/input>/g, '')
    .replace(/\s+/g, ' ')
    .replace(
      new RegExp(`\\s*(</?(?:${BLOCK_TAGS})(?: [^>]*)?>)\\s*`, 'g'),
      '$1',
    )
    .replace(/<code>\s+|\s+<\/code>/g, (m) => m.trim())
    .replace(/&(#?\w+);/g, (m, entity) => ENTITIES[entity] ?? m)
    .trim();
  return sortNestedMarks(normalized);
}

// --- renderers ---

const decoder = new TextDecoder();

async function kerebron(md: string) {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [new BrowserLessEditorKit()],
  });
  await editor.loadDocumentText('text/x-markdown', md);
  return {
    html: decoder.decode(await editor.saveDocument('text/html')),
    saved: decoder.decode(await editor.saveDocument('text/x-markdown')).trim(),
  };
}

async function pandoc(from: string, md: string): Promise<string> {
  const child = new Deno.Command('pandoc', {
    args: ['-f', from, '-t', 'html', '--mathml', '--wrap=none'],
    stdin: 'piped',
    stdout: 'piped',
  }).spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(md));
  await writer.close();
  return decoder.decode((await child.output()).stdout);
}

async function command(cmd: string, args: string[]): Promise<string> {
  const { stdout } = await new Deno.Command(cmd, { args }).output();
  return decoder.decode(stdout).trim();
}

async function compare(sample: DialectCase): Promise<Result> {
  const first = await kerebron(sample.md);
  const reloaded = await kerebron(first.saved);
  const html = normalizeHtml(first.html);
  return {
    ...sample,
    kerebron: html,
    saved: first.saved,
    stable: normalizeHtml(reloaded.html) === html,
    refs: {
      gfm: normalizeHtml(micromark(sample.md, {
        allowDangerousHtml: true,
        extensions: [gfm()],
        htmlExtensions: [gfmHtml()],
      })),
      marked: normalizeHtml(marked.parse(sample.md, { async: false })),
      pandocGfm: normalizeHtml(await pandoc('gfm', sample.md)),
      pandoc: normalizeHtml(await pandoc('markdown', sample.md)),
    },
  };
}

// Kerebron logs unsupported nodes/marks; the report already shows them.
async function quietly<T>(run: () => Promise<T>): Promise<T> {
  const { debug, warn } = console;
  console.debug = console.warn = () => {};
  try {
    return await run();
  } finally {
    Object.assign(console, { debug, warn });
  }
}

// --- report ---

function code(text: string): string {
  if (!text) return '∅';
  const clipped = text.length > MAX_CELL
    ? text.slice(0, MAX_CELL - 1) + '…'
    : text;
  const escaped = clipped.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/\|/g, '&#124;').replace(/\n/g, '⏎');
  return `<code>${escaped}</code>`;
}

const isPandocExtension = (r: Result) => r.refs.pandoc !== r.refs.gfm;

function followsWhom(r: Result): string {
  if (r.kerebron === r.refs.pandoc) return 'Pandoc ✅';
  if (r.kerebron === r.refs.gfm) return 'GFM';
  return 'neither ❌';
}

function savedCell(r: Result): string {
  const saved = r.saved === r.md.trim() ? '✓' : code(r.saved);
  return r.stable ? saved : `${saved} ⚠️ reloads differently`;
}

function groupTable(results: Result[]): string {
  const refNames = Object.keys(REFERENCES) as Reference[];
  const header = [
    'Input',
    'Kerebron',
    'Saved as',
    ...refNames.map((n) => REFERENCES[n]),
  ];
  const rows = results.map((r) => [
    code(r.md) + (r.note ? `<br>${r.note}` : ''),
    code(r.kerebron),
    savedCell(r),
    ...refNames.map((n) => r.refs[n] === r.kerebron ? '✓' : code(r.refs[n])),
  ]);
  return [header, header.map(() => '---'), ...rows]
    .map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

function summary(results: Result[]): string {
  const total = results.length;
  const agreement = (Object.keys(REFERENCES) as Reference[])
    .map((n) => {
      const matches = results.filter((r) => r.refs[n] === r.kerebron).length;
      return `| ${REFERENCES[n]} | ${matches} / ${total} |`;
    });
  const gfmDiffs = results.filter((r) => r.kerebron !== r.refs.gfm);
  const extensions = results.filter(isPandocExtension);
  const list = (title: string, matching: Result[]) =>
    `**${title} (${matching.length}):** ` +
    (matching.map((r) => code(r.md)).join(', ') || 'none');

  return [
    '### Summary',
    '',
    '| Reference | Samples where Kerebron matches |',
    '| --- | --- |',
    ...agreement,
    '',
    list(
      'Follows Pandoc instead of GFM',
      gfmDiffs.filter((r) => r.kerebron === r.refs.pandoc),
    ),
    '',
    list(
      'Matches neither GFM nor Pandoc',
      gfmDiffs.filter((r) => r.kerebron !== r.refs.pandoc),
    ),
    '',
    list(
      'Renders differently after save and reload',
      results.filter((r) => !r.stable),
    ),
    '',
    `### Pandoc extensions (${extensions.length} samples where Pandoc differs from GFM)`,
    '',
    '| Input | GFM | Pandoc | Kerebron | Kerebron follows |',
    '| --- | --- | --- | --- | --- |',
    ...extensions.map((r) =>
      `| ${code(r.md)} | ${code(r.refs.gfm)} | ${code(r.refs.pandoc)} | ${
        code(r.kerebron)
      } | ${followsWhom(r)} |`
    ),
  ].join('\n');
}

async function report(): Promise<string> {
  const sections: string[] = [];
  const all: Result[] = [];
  for (const [title, samples] of Object.entries(groups)) {
    const results: Result[] = [];
    for (const sample of samples) results.push(await compare(sample));
    all.push(...results);
    sections.push(`#### ${title}\n\n${groupTable(results)}`);
  }

  const commit = await command('git', ['rev-parse', '--short', 'HEAD']);
  const dirty = await command('git', [
    'status',
    '--porcelain',
    'packages',
    'vendor',
    'utils/markdown-dialects',
  ]);
  const pandocVersion = (await command('pandoc', ['--version'])).split('\n')[0];

  return [
    `_Generated by [compare.ts](../utils/markdown-dialects/compare.ts) from \`${commit}${
      dirty ? '+dirty' : ''
    }\` ` +
    `with ${pandocVersion}, ${LIBRARY_VERSIONS}. Do not edit by hand._`,
    '',
    summary(all),
    '',
    '### All samples',
    '',
    '`✓` means the same as Kerebron after normalization.',
    '',
    ...sections.flatMap((s) => [s, '']),
  ].join('\n');
}

async function writeReport() {
  const doc = await Deno.readTextFile(DOC_URL);
  const start = doc.indexOf(RESULTS_START);
  const end = doc.indexOf(RESULTS_END);
  if (start < 0 || end < start) {
    throw new Error(
      `${DOC_URL.pathname} needs ${RESULTS_START} and ${RESULTS_END} markers`,
    );
  }
  const results = await quietly(report);
  await Deno.writeTextFile(
    DOC_URL,
    `${doc.slice(0, start + RESULTS_START.length)}\n\n${results}\n${
      doc.slice(end)
    }`,
  );
  console.log(
    `Updated ${DOC_URL.pathname}; review with: git diff docs/markdown-dialects.md`,
  );
}

async function printSnippet(md: string) {
  const r = await quietly(() => compare({ md }));
  const rows: Array<[string, string]> = [
    ['Kerebron', r.kerebron],
    ['  saved as', `${r.saved}${r.stable ? '' : '   ⚠️ reloads differently'}`],
    ...(Object.keys(REFERENCES) as Reference[]).map((n): [string, string] => [
      REFERENCES[n],
      r.refs[n] === r.kerebron ? '✓ same as Kerebron' : r.refs[n],
    ]),
  ];
  for (const [label, value] of rows) console.log(label.padEnd(12), value);
}

const mdIndex = Deno.args.indexOf('--md');
if (mdIndex >= 0) {
  await printSnippet(Deno.args[mdIndex + 1] ?? '');
} else {
  await writeReport();
}
