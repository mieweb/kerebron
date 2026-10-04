import MathMl2LaTeX from 'mathml2latex';

import type {
  ContextStash,
  SerializerContext,
  TokenHandler,
} from '@kerebron/extension-markdown/MarkdownSerializer';

import type { Token } from '../types.ts';
import { fixCharacters } from '../utils.ts';

export function escapeMarkdown(
  token: Token,
  current: SerializerContext,
): Array<[string, Token]> {
  const markdownChars = [
    { char: '\\', escape: '\\\\' },
    // { char: '*', escape: '\\*' },
    // { char: '_', escape: '\\_' },
    { char: '#', escape: '\\#' },
    { char: '$', escape: '\\$' },
    // { char: '[', escape: '\\[' },
    // { char: ']', escape: '\\]' },
    // { char: '(', escape: '\\(' },
    // { char: ')', escape: '\\)' },
    // { char: '`', escape: '\\`' },
    // { char: '>', escape: '\\>' },
    { char: '<', escape: '\\<' },
    // { char: '.', escape: '\\.' },
    // { char: '!', escape: '\\!' },
    // { char: '|', escape: '\\|' },
    // { char: '{', escape: '\\{' },
    // { char: '}', escape: '\\}' },
    { char: '…', escape: '...' },
    { char: '©', escape: '(c)' },
    { char: '®', escape: '(r)' },
    { char: '™', escape: '(tm)' },
    { char: '±', escape: '+-' },
    { char: '—', escape: '---' },
  ];

  const escapeChars: string[] = (current.meta.escapeChars || '').split('');

  const startPos = token.map && token.map.length > 0 ? token.map[0] : 0;
  if (!startPos) {
    let escapedText = fixCharacters(token.content);
    for (const { char, escape } of markdownChars) {
      if (escapeChars.includes(char)) {
        escapedText = escapedText.replaceAll(char, escape);
      }
    }

    return [[escapedText, token]];
  }

  const charArr = fixCharacters(token.content).split('');
  const retVal: Array<[string, Token]> = [];

  const markdownCharsMap: Record<string, string> = Object.fromEntries(
    markdownChars.map((c) => [c.char, c.escape]),
  );

  let offset = 0;
  let inStr = '';
  let currentOutStr = '';

  const flush = () => {
    if (currentOutStr.length > 0) {
      const tok = structuredClone(token);
      tok.map = [startPos + offset];
      retVal.push([
        currentOutStr,
        tok,
      ]);
      offset = inStr.length;
    }
    currentOutStr = '';
  };

  for (let idx = 0; idx < charArr.length; idx++) {
    const char = charArr[idx];

    inStr += char;
    if (!escapeChars.includes(char)) {
      currentOutStr += char;
      continue;
    }

    if (markdownCharsMap[char]) {
      flush();
    }
    currentOutStr += markdownCharsMap[char] || char;
    if (markdownCharsMap[char]) {
      flush();
    }
  }

  flush();

  return retVal;
}

function getLinkTokensHandlers(): Record<string, Array<TokenHandler>> {
  return {
    'text': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.meta['link_text'] += token.content;
        if (token.content && !ctx.current.meta['link_token_token']) {
          ctx.current.meta['link_token_token'] = token;
        }
      },
    ],

    'link_close': [
      (token: Token, ctx: ContextStash) => {
        {
          const lastStackToken: Token = ctx.current.meta['link_open_token'];
          const href: string = lastStackToken.attrGet('href') || '';
          const title: string = lastStackToken.attrGet('title') || '';
          const origUrl: string = lastStackToken.attrGet('origUrl') || href;

          let link_text = ctx.current.meta['link_text'];
          if (origUrl === link_text) {
            link_text = href;
          }

          let mdTemplate = lastStackToken.attrGet('mdTemplate');
          if (mdTemplate) {
            const basename = href.split('/').pop();
            mdTemplate = mdTemplate.replaceAll('$href', href);
            mdTemplate = mdTemplate.replaceAll('$basename', basename || '');
            mdTemplate = mdTemplate.replaceAll(
              '$label',
              ctx.current.meta['link_text'],
            );
            mdTemplate = mdTemplate.replaceAll('$title', title || '');

            ctx.current.log(mdTemplate, token);
          } else {
            if (!title && link_text === href) {
              ctx.current.log(href, token);
            } else if (!title && !href) {
              ctx.current.log('[', token);
              ctx.current.log(
                link_text,
                ctx.current.meta['link_token_token'],
              );
              ctx.current.log(`]${title}`, token);
            } else {
              ctx.current.log('[', token);
              ctx.current.log(
                link_text,
                ctx.current.meta['link_token_token'],
              );
              if (title) {
                ctx.current.log(`](${href} ${title})`, token);
              } else {
                ctx.current.log(`](${href})`, token);
              }
            }
          }

          ctx.unstash('getLinkTokensHandlers.link_close');
        }
      },
    ],

    default: [
      (token: Token, ctx: ContextStash) => {
        // Ignore other stuff
        // TODO: images?
      },
    ],
  };
}

// Open delimiter marks: chars backslash-escaped in their text (see
// WRAPPING_INLINE_NODES in treeSitterTokenizer.ts for the matching unescape)
interface OpenMark {
  chars: string;
  html: boolean;
}
const markStack = (ctx: ContextStash): OpenMark[] =>
  ctx.current.meta['markStack'] ?? [];
const pushMark = (ctx: ContextStash, mark: OpenMark) => {
  ctx.current.meta['markStack'] = [...markStack(ctx), mark];
};
const popMark = (ctx: ContextStash): OpenMark | undefined => {
  const stack = markStack(ctx);
  ctx.current.meta['markStack'] = stack.slice(0, -1);
  return stack[stack.length - 1];
};
const escapeMarkDelimiters = (text: string, ctx: ContextStash) => {
  const chars = markStack(ctx).map((m) => m.chars).join('');
  return chars
    ? [...text].map((c) => chars.includes(c) ? '\\' + c : c).join('')
    : text;
};

// Falls back to an HTML tag when an enclosing mark already uses the same
// delimiter character (strike + subscript would write `~~~x~~~`)
function delimiterHandlers(
  name: string,
  markup: string,
  escaped: string,
  htmlTag: string,
): Record<string, Array<TokenHandler>> {
  return {
    [name + '_open']: [(token: Token, ctx: ContextStash) => {
      const delimiter = token.markup || markup;
      const html = markStack(ctx).some((m) => m.chars.includes(delimiter[0]));
      ctx.current.log(html ? `<${htmlTag}>` : delimiter, token);
      pushMark(ctx, { chars: html ? '' : escaped + '\\', html });
    }],
    [name + '_close']: [(token: Token, ctx: ContextStash) => {
      const html = popMark(ctx)?.html;
      ctx.current.log(html ? `</${htmlTag}>` : token.markup || markup, token);
    }],
  };
}

function escapeHtmlAttr(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// `markup` is used when the mark has no color, otherwise a styled HTML tag
// whose content is written as HTML (markdown is not parsed inside it)
function colorTagHandlers(
  name: string,
  tag: string,
  cssProp: string,
  markup?: string,
  escaped = '',
): Record<string, Array<TokenHandler>> {
  return {
    [name + '_open']: [(token: Token, ctx: ContextStash) => {
      const color = token.attrGet('color');
      if (!color) {
        ctx.current.log(markup ?? `<${tag}>`, token);
        if (markup) pushMark(ctx, { chars: escaped + '\\', html: false });
        return;
      }
      ctx.current.log(
        `<${tag} style="${cssProp}: ${escapeHtmlAttr(color)};">`,
        token,
      );
      ctx.stash(name + '_open');
      ctx.current.handlers = getHtmlInlineTokensHandlers();
    }],
    [name + '_close']: [(token: Token, ctx: ContextStash) => {
      if (!token.attrGet('color')) {
        if (markup) popMark(ctx);
        ctx.current.log(markup ?? `</${tag}>`, token);
        return;
      }
      ctx.current.log(`</${tag}>`, token);
      ctx.unstash(name + '_close');
    }],
  };
}

export function getInlineTokensHandlers(): Record<string, Array<TokenHandler>> {
  return {
    'text': [
      (token: Token, ctx: ContextStash) => {
        if (token.meta === 'noEscText') {
          ctx.current.log(escapeMarkDelimiters(token.content, ctx));
        } else {
          for (const pair of escapeMarkdown(token, ctx.current)) {
            ctx.current.log(escapeMarkDelimiters(pair[0], ctx), pair[1]);
          }
        }
      },
    ],
    'entity': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.content);
      },
    ],
    'strong_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '**', token);
      },
    ],
    'strong_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '**', token);
      },
    ],
    'em_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '*', token);
      },
    ],
    'em_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '*', token);
      },
    ],
    'underline_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '_', token);
      },
    ],
    'underline_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '_', token);
      },
    ],
    ...delimiterHandlers('strike', '~~', '~', 'strike'),
    ...delimiterHandlers('subscript', '~', ' \t~', 'sub'),
    ...delimiterHandlers('superscript', '^', ' \t^', 'sup'),
    ...colorTagHandlers('highlight', 'mark', 'background-color', '==', '='),
    ...colorTagHandlers('text_color', 'span', 'color'),

    'link_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash('getInlineTokensHandlers.link_open');

        ctx.current.handlers = getLinkTokensHandlers();

        ctx.current.meta['link_open_token'] = token;
        ctx.current.meta['link_text'] = '';
        ctx.current.meta['link_token_token'] = null;
      },
    ],

    'code_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '`', token);
      },
    ],
    'code_close': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.markup || '`', token);
      },
    ],

    'code_inline': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('`' + token.content + '`', token);
      },
    ],

    'math': [
      (token: Token, ctx: ContextStash) => {
        let content = token.content;
        if (token.attrGet('lang') === 'mathml') {
          const cleaned = content.replace(
            /<annotation[\s\S]*?<\/annotation>/g,
            '',
          );
          content = MathMl2LaTeX.convert(cleaned);
        }
        ctx.current.log('$' + content + '$', token);
      },
    ],
    'hardbreak': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(ctx.current.lineBreak + '\n', token);
      },
    ],
    'softbreak': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('\n', token);
      },
    ],

    'image': [
      (token: Token, ctx: ContextStash) => {
        {
          const src = token.attrGet('src');
          const altAttr = token.attrGet('alt');

          let alt = altAttr || '';
          if (token.children) {
            for (const child of token.children) {
              if (child.type === 'text') {
                alt += child.content;
              }
            }
          }

          let mdTemplate = '![$alt]';
          const title = token.attrGet('title');
          if (src) {
            if (title) {
              mdTemplate += '($src $title)';
            } else {
              mdTemplate += '($src)';
            }
          }

          mdTemplate = token.attrGet('mdTemplate') || mdTemplate;

          mdTemplate = mdTemplate.replaceAll('$alt', alt);
          mdTemplate = mdTemplate.replaceAll('$label', alt);
          mdTemplate = mdTemplate.replaceAll('$src', src || '');
          mdTemplate = mdTemplate.replaceAll('$title', title || '');

          ctx.current.log(
            mdTemplate,
            token,
          );
        }
      },
    ],

    'html_block': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.content, token);
      },
    ],

    'footnote_ref': [
      (token: Token, ctx: ContextStash) => {
        if (token.meta.label) {
          ctx.current.log(`[^${token.meta.label}]`, token);
        } else {
          ctx.current.log(`[^footnote_${token.meta.id}]`, token);
        }
      },
    ],

    'shortcode_inline': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('{{' + token.content + '}}', token);
      },
    ],

    'bookmark': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(`<a id="${token.attrGet('id')}"></a>`, token);
      },
    ],
  };
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function escapeHtml(text: string) {
  return text.replace(/[&<>]/g, (c) => HTML_ESCAPES[c]);
}

export function getHtmlInlineFormatTokensHandlers(): Record<
  string,
  Array<TokenHandler>
> {
  return {
    'strong_open': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'strong';
        ctx.current.log(`<${tag}>`, token);
      },
    ],
    'strong_close': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'strong';
        ctx.current.log(`</${tag}>`, token);
      },
    ],
    'em_open': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'em';
        ctx.current.log(`<${tag}>`, token);
      },
    ],
    'em_close': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'em';
        ctx.current.log(`</${tag}>`, token);
      },
    ],
    'strike_open': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'strike';
        ctx.current.log(`<${tag}>`, token);
      },
    ],
    'strike_close': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'strike';
        ctx.current.log(`</${tag}>`, token);
      },
    ],
    'underline_open': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'u';
        ctx.current.log(`<${tag}>`, token);
      },
    ],
    'underline_close': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'u';
        ctx.current.log(`</${tag}>`, token);
      },
    ],
    ...htmlTagHandlers('subscript', 'sub'),
    ...htmlTagHandlers('superscript', 'sup'),
    ...colorTagHandlers('highlight', 'mark', 'background-color'),
    ...colorTagHandlers('text_color', 'span', 'color'),
  };
}

function htmlTagHandlers(
  name: string,
  defaultTag: string,
): Record<string, Array<TokenHandler>> {
  return {
    [name + '_open']: [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(`<${token.tag || defaultTag}>`, token);
      },
    ],
    [name + '_close']: [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(`</${token.tag || defaultTag}>`, token);
      },
    ],
  };
}

export function getHtmlInlineTokensHandlers(): Record<
  string,
  Array<TokenHandler>
> {
  return {
    'in_html': [],
    'text': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(escapeHtml(token.content), token);
      },
    ],
    'entity': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.content, token);
      },
    ],
    ...getHtmlInlineFormatTokensHandlers(),
    'link_open': [
      (token: Token, ctx: ContextStash) => {
        ctx.stash('getHtmlInlineTokensHandlers.link_open');

        const href = token.attrGet('href') || '';
        const titleValue = token.attrGet('title');

        const title = titleValue ? ' "' + titleValue + '"' : '';

        ctx.current.log(`<a href="${href}">`, token);
      },
    ],

    'link_close': [
      (token: Token, ctx: ContextStash) => {
        {
          ctx.current.log('</a>', token);
          ctx.unstash('getHtmlInlineTokensHandlers.link_close');
        }
      },
    ],

    'code_open': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'code';
        ctx.current.log(`<${tag}>`, token);
      },
    ],
    'code_close': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'code';
        ctx.current.log(`</${tag}>`, token);
      },
    ],

    // 'code_inline': [
    //   (token: Token, ctx: ContextStash) => {
    //     const tag = token.tag || 'code';
    //     ctx.current.log(`<${tag}>`, token);
    //     ctx.current.log(token.content || '', token);
    //     ctx.current.log(`</${tag}>`, token);
    //   },
    // ],
    'math': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(
          '<math xmlns="http://www.w3.org/1998/Math/MathML">',
          token,
        );
        ctx.current.log(token.content, token);
        ctx.current.log('</math>', token);
      },
    ],
    'hardbreak': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'br';
        ctx.current.log(`<${tag} />\n`, token);
      },
    ],
    'softbreak': [
      (token: Token, ctx: ContextStash) => {
        const tag = token.tag || 'wbr';
        ctx.current.log(`<${tag} />\n`, token);
      },
    ],

    'image': [
      (token: Token, ctx: ContextStash) => {
        {
          // const src = token.attrGet('src');
          // const alt = token.attrGet('alt');
          let alt = '';
          if (token.children) {
            for (const child of token.children) {
              if (child.type === 'text') {
                alt += child.content;
              }
            }
          }
          // const title = token.attrGet('title');

          // ctx.current.log(`![${alt}]`, token);
          // if (src) {
          //   ctx.current.log(
          //     `(${src}${title ? ' "' + title + '"' : ''})`, token
          //   );
          // }

          // TODO

          const tag = token.tag || 'img';
          ctx.current.log(`<${tag} />`, token);
        }
      },
    ],
    'html_block': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(token.content, token);
      },
    ],

    'footnote_ref': [
      (token: Token, ctx: ContextStash) => {
      },
    ],

    'shortcode_inline': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log('{{' + token.content + '}}', token);
      },
    ],

    'bookmark': [
      (token: Token, ctx: ContextStash) => {
        ctx.current.log(`<a id="${token.attrGet('id')}"></a>`, token);
      },
    ],
  };
}
