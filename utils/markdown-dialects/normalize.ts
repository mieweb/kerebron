/** HTML normalization so renderers are compared by content, not markup style. */

const TAG_ALIASES: Record<string, string> = {
  strike: 'del',
  s: 'del',
  b: 'strong',
  i: 'em',
};
const DROPPED_TAGS = new Set([
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
const BLOCK_TAG = `</?(?:${BLOCK_TAGS})(?: [^>]*)?>`;
const PARAGRAPH = '¶';
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  copy: '©',
  nbsp: ' ',
};
// Generated footnote anchors differ per renderer (#fn1, #user-content-fn-1, ...)
const FOOTNOTE_HREF = /^#(user-content-)?fn/;

function keptAttrs(attrs: string): string {
  let out = '';
  for (
    const [, key, value = ''] of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)
  ) {
    const align = key === 'style' && value.match(/text-align:\s*(\w+)/)?.[1];
    if (align || key === 'align') out += ` align="${align || value}"`;
    else if (key === 'checked') out += ' checked';
    else if (KEPT_ATTRS.has(key)) {
      out += ` ${key}="${FOOTNOTE_HREF.test(value) ? '#' : value}"`;
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
        if (name === 'p') return ` ${PARAGRAPH} `;
        if (DROPPED_TAGS.has(name)) return ' ';
        return closing ? `</${name}>` : `<${name}${keptAttrs(attrs)}>`;
      },
    )
    .replace(/<a[^>]*><\/a>|<\/input>/g, '')
    .replace(/\s+/g, ' ')
    // a paragraph boundary only matters between runs of inline content
    .replace(new RegExp(`( ?${PARAGRAPH} ?)+`, 'g'), ` ${PARAGRAPH} `)
    .replace(new RegExp(`\\s*${PARAGRAPH}\\s*(${BLOCK_TAG})`, 'g'), '$1')
    .replace(new RegExp(`(${BLOCK_TAG})\\s*${PARAGRAPH}\\s*`, 'g'), '$1')
    .replace(new RegExp(`^\\s*${PARAGRAPH}|${PARAGRAPH}\\s*$`, 'g'), '')
    .replace(new RegExp(`\\s*(${BLOCK_TAG})\\s*`, 'g'), '$1')
    .replace(/<code>\s+|\s+<\/code>/g, (m) => m.trim())
    .replace(/&(#?\w+);/g, (m, entity) => ENTITIES[entity] ?? m)
    .trim();
  return sortNestedMarks(normalized);
}
