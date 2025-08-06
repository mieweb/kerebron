import type { Node, Schema } from 'prosemirror-model';
import { DOMSerializer, Fragment } from 'prosemirror-model';
import MarkdownIt from 'markdown-it';

import Token from 'markdown-it/lib/token.mjs';

import { type Converter, type CoreEditor, Extension } from '@kerebron/editor';
import { Mark } from '@kerebron/editor';

import { MarkdownSerializer } from './MarkdownSerializer.ts';
import { MarkdownParser } from './MarkdownParser.ts';

import { romanize } from './utils.ts';

function listIsTight(tokens: readonly Token[], i: number) {
  while (++i < tokens.length) {
    if (tokens[i].type != 'list_item_open') return tokens[i].hidden;
  }
  return false;
}

function removeMarkedContent(node, markType) {
  if (node.isText) {
    const hasMark = node.marks.some((mark) => mark.type === markType);
    return hasMark ? null : node;
  }

  if (node.isLeaf) {
    return node;
  }

  const newContent = [];

  node.content.forEach((child) => {
    const cleaned = removeMarkedContent(child, markType);
    if (cleaned) {
      newContent.push(cleaned);
    }
  });

  return node.copy(Fragment.fromArray(newContent));
}

function convertDomToLowerCase(node) {
  // If the node is an element, change its tag name and attributes
  if (node.nodeType === 1) { // Element node
    // Convert tag name to lowercase
    try {
      node.nodeName = node.nodeName.toLowerCase();
    } catch (ignore) {
      /* HACK FOR: Uncaught TypeError: setting getter-only property "nodeName" */
    }

    // Loop through attributes and convert them to lowercase
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      node.setAttribute(attr.name.toLowerCase(), attr.value);
    }
  }

  // Recursively convert children nodes
  for (let i = 0; i < node.childNodes.length; i++) {
    convertDomToLowerCase(node.childNodes[i]);
  }
}

export class ExtensionMarkdown extends Extension {
  name = 'markdown';

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    const domSerializer = DOMSerializer.fromSchema(schema);
    const autoLinks = false; // TODO - config
    return {
      'text/x-markdown': {
        fromDoc: async (document: Node): Promise<Uint8Array> => {
          /// A serializer for the [basic schema](#schema).
          const defaultMarkdownSerializer = new MarkdownSerializer({
            html(state, node) {
              const domSerializer = DOMSerializer.fromSchema(schema);
              const element = domSerializer.serializeNode(node, {
                document: globalThis.document,
              });
              convertDomToLowerCase(element);
              const xmlSerializer = new XMLSerializer();
              const html = xmlSerializer.serializeToString(element) + '\n';
              // state.write(html.replace(/\sxmlns="[^"]*"/, ''));
              state.write(html);
            },
            blockquote(state, node) {
              state.wrapBlock(
                '> ',
                null,
                node,
                () => state.renderContent(node),
              );
            },
            code_block(state, node) {
              // Make sure the front matter fences are longer than any dash sequence within it
              const backticks = node.textContent.match(/`{3,}/gm);
              const fence = backticks
                ? (backticks.sort().slice(-1)[0] + '`')
                : '```';

              state.write(fence + (node.attrs.lang || '') + '\n');
              state.text(node.textContent, false);
              // Add a newline to the current content before adding closing marker
              state.write('\n');
              state.write(fence);
              state.closeBlock(node);
            },
            heading(state, node) {
              state.write(state.repeat('#', node.attrs.level) + ' ');
              state.renderInline(node, false);
              state.closeBlock(node);
            },
            hr(state, node) {
              state.write(node.attrs.markup || '---');
              state.closeBlock(node);
            },
            bullet_list(state, node) {
              state.renderList(
                node,
                '    ',
                () => (node.attrs.bullet || '*') + ' ',
              );
            },
            ordered_list(state, node) {
              let start = node.attrs.start || 1;
              let maxW = String(start + node.childCount - 1).length;
              let space = state.repeat(' ', 4);

              let numericString = (i: number) => String(i) + '. ';

              if (['a'].includes(node.attrs?.type || '')) {
                numericString = (i: number) =>
                  String.fromCharCode('a'.charCodeAt(0) + i - 1) + '.  ';
              }
              if (['A'].includes(node.attrs?.type || '')) {
                numericString = (i: number) =>
                  String.fromCharCode('A'.charCodeAt(0) + i - 1) + '.  ';
              }
              if (['I'].includes(node.attrs?.type || '')) {
                numericString = (i: number) => `${romanize(i)}. `;
              }
              if (['i'].includes(node.attrs?.type || '')) {
                numericString = (i: number) => `${romanize(i).toLowerCase()}. `;
              }

              state.renderList(node, space, (i) => {
                const number = start + i;

                let nStr = numericString(number);
                return state.repeat(' ', maxW - nStr.length) + nStr;
              });
            },
            list_item(state, node) {
              state.renderContent(node);
            },
            paragraph(state, node) {
              state.renderInline(node);
              state.closeBlock(node);
            },
            image(state, node) {
              state.write(
                '![' + state.esc(node.attrs.alt || '') + '](' +
                  node.attrs.src.replace(/[\(\)]/g, '\\$&') +
                  (node.attrs.title
                    ? ' "' + node.attrs.title.replace(/"/g, '\\"') + '"'
                    : '') +
                  ')',
              );
            },
            br(state, node, parent, index) {
              for (let i = index + 1; i < parent.childCount; i++) {
                if (parent.child(i).type != node.type) {
                  state.write('\\\n');
                  return;
                }
              }
            },
            text(state, node) {
              state.text(node.text!, !state.inAutolink);
            },
          }, {
            em: {
              open: '*',
              close: '*',
              mixable: true,
              expelEnclosingWhitespace: true,
            },
            strong: {
              open: '**',
              close: '**',
              mixable: true,
              expelEnclosingWhitespace: true,
            },
            link: {
              open(state, mark, parent, index) {
                state.inAutolink = autoLinks && isPlainURL(mark, parent, index);
                return state.inAutolink ? '<' : '[';
              },
              close(state, mark, parent, index) {
                let { inAutolink } = state;
                state.inAutolink = undefined;
                return inAutolink
                  ? '>'
                  : '](' + mark.attrs.href.replace(/[\(\)"]/g, '\\$&') +
                    (mark.attrs.title
                      ? ` "${mark.attrs.title.replace(/"/g, '\\"')}"`
                      : '') +
                    ')';
              },
              mixable: true,
            },
            bookmark: {
              open(state, mark) {
                const id = mark.attrs.id;
                if (state.alreadyOutputedIds.has(id)) {
                  return '';
                }

                state.alreadyOutputedIds.add(id);
                return `<a id="${id}"></a>`;
              },
              close() {
                return '';
              },
            },
            code: {
              open(_state, _mark, parent, index) {
                return backticksFor(parent.child(index), -1);
              },
              close(_state, _mark, parent, index) {
                return backticksFor(parent.child(index - 1), 1);
              },
              escape: false,
            },
          });

          function backticksFor(node: Node, side: number) {
            let ticks = /`+/g, m, len = 0;
            if (node.isText) {
              // deno-lint-ignore no-cond-assign
              while (m = ticks.exec(node.text!)) {
                len = Math.max(len, m[0].length);
              }
            }
            let result = len > 0 && side > 0 ? ' `' : '`';
            for (let i = 0; i < len; i++) result += '`';
            if (len > 0 && side < 0) result += ' ';
            return result;
          }

          function isPlainURL(link: Mark, parent: Node, index: number) {
            if (link.attrs.title || !/^\w+:/.test(link.attrs.href)) {
              return false;
            }
            let content = parent.child(index);
            if (
              !content.isText || content.text != link.attrs.href ||
              content.marks[content.marks.length - 1] != link
            ) return false;
            return index == parent.childCount - 1 ||
              !link.isInSet(parent.child(index + 1).marks);
          }

          document = removeMarkedContent(document, schema.marks.change);
          // deleteAllMarkedText('change', state, dispatch)

          return new TextEncoder().encode(
            defaultMarkdownSerializer.serialize(document),
          );
        },
        toDoc: async (buffer: Uint8Array): Promise<Node> => {
          const content = new TextDecoder().decode(buffer);
          /// A parser parsing unextended [CommonMark](http://commonmark.org/),
          /// without inline HTML, and producing a document in the basic schema.
          const defaultMarkdownParser = new MarkdownParser(
            schema,
            MarkdownIt('commonmark', { html: false }),
            {
              blockquote: { block: 'blockquote' },
              paragraph: { block: 'paragraph' },
              list_item: { block: 'list_item' },
              bullet_list: {
                block: 'bullet_list',
                getAttrs: (_, tokens, i) => ({ tight: listIsTight(tokens, i) }),
              },
              ordered_list: {
                block: 'ordered_list',
                getAttrs: (tok, tokens, i) => ({
                  start: +tok.attrGet('start')! || 1,
                  tight: listIsTight(tokens, i),
                }),
              },
              heading: {
                block: 'heading',
                getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
              },
              code_block: { block: 'code_block', noCloseToken: true },
              fence: {
                block: 'code_block',
                getAttrs: (tok) => ({ params: tok.info || '' }),
                noCloseToken: true,
              },
              hr: { node: 'hr' },
              image: {
                node: 'image',
                getAttrs: (tok) => ({
                  src: tok.attrGet('src'),
                  title: tok.attrGet('title') || null,
                  alt: tok.children![0] && tok.children![0].content || null,
                }),
              },
              hardbreak: { node: 'br' },
              em: { mark: 'em' },
              strong: { mark: 'strong' },
              link: {
                mark: 'link',
                getAttrs: (tok) => ({
                  href: tok.attrGet('href'),
                  title: tok.attrGet('title') || null,
                }),
              },
              code_inline: { mark: 'code', noCloseToken: true },
              html_block: { // TODO
                block: 'code_block',
              },
            },
          );

          return defaultMarkdownParser.parse(content);
        },
      },
    };
  }
}
