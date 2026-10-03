/**
 * Official CommonMark and GFM spec examples, scored against Kerebron.
 *
 * specs/*.json are copied verbatim from markedjs/marked at tag v16.4.2
 * (test/specs/commonmark/commonmark.0.31.2.json, test/specs/gfm/gfm.0.29.json).
 * specs/kerebron-passing.json lists the examples Kerebron passes; spec.test.ts
 * fails if any of them regress. Refresh it with:
 *
 *   UPDATE_SPEC_BASELINE=1 deno task test:spec
 */
import { normalizeHtml } from './normalize.ts';
import { kerebron } from './render.ts';

export interface SpecExample {
  section: string;
  markdown: string;
  html: string;
  example: number;
}

export interface Spec {
  name: string;
  /** Link to an example: `${url}${example}` */
  url: string;
  examples: SpecExample[];
}

const load = (file: string): SpecExample[] =>
  JSON.parse(Deno.readTextFileSync(new URL(`specs/${file}`, import.meta.url)));

export const specs: Spec[] = [
  {
    name: 'CommonMark 0.31.2',
    url: 'https://spec.commonmark.org/0.31.2/#example-',
    examples: load('commonmark.0.31.2.json'),
  },
  {
    name: 'GFM 0.29 extensions',
    url: 'https://github.github.com/gfm/#example-',
    examples: load('gfm.0.29.json'),
  },
];

export const BASELINE_URL = new URL(
  'specs/kerebron-passing.json',
  import.meta.url,
);

/** Spec name -> example numbers that passed when the baseline was recorded */
export type Baseline = Record<string, number[]>;

export const expectedHtml = (ex: SpecExample) => normalizeHtml(ex.html);

export async function kerebronHtml(ex: SpecExample): Promise<string> {
  try {
    return normalizeHtml((await kerebron(ex.markdown)).html);
  } catch (e) {
    return `THROW ${(e as Error).message}`;
  }
}
