import MarkdownIt from 'markdown-it';
import markdownDefList from 'npm:markdown-it-deflist@3.0.0';
import markdownFootnote from 'npm:markdown-it-footnote@4.0.0';
import { markdownItTable } from 'npm:markdown-it-table@4.1.1';
import markdownSub from './markdown-it/markdown-it-sub.ts';
import markdownSup from './markdown-it/markdown-it-sup.ts';
import markdownCode from './markdown-it/markdown-it-code.ts';
import markdownMath from 'npm:markdown-it-math@5.2.1';

export function defaultTokenizer() {
  throw new Error('deprec');

  // const markdownIt = new MarkdownIt('commonmark', { html: false });
  const markdownIt = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    // highlight: true,
    quotes: '""\'\'',
  });

  markdownIt.use(markdownDefList);
  markdownIt.use(markdownFootnote);
  markdownIt.use(markdownItTable);
  // markdownIt.use(markdownCode);
  // markdownIt.use(markdownMath);
  markdownIt.use(markdownSub);
  markdownIt.use(markdownSup);

  return markdownIt;
}
