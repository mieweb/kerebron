import { assertEquals } from '@std/assert';
import { EditorState, Plugin, Transaction } from 'prosemirror-state';

import {
  CoreEditor,
  Extension,
  NESTING_CLOSING,
  NESTING_OPENING,
  NodeAndPos,
  nodeToTreeString,
  UrlRewriteContext,
} from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { assetLoad } from '@kerebron/wasm/deno';

import { urlToFolderId } from './idParsers.ts';
import { Schema } from 'prosemirror-model';
import { getDefaultsPreProcessFilters } from '@kerebron/extension-markdown/preProcess';
import { Command } from '@kerebron/editor/commands';

const __dirname = import.meta.dirname;

function rawHtmlMacro(): Command {
  return (state: EditorState, dispatch) => {
    const pairs: Record<string, [NodeAndPos?, NodeAndPos?]> = {};

    const tr = state.tr;
    const schema = state.schema;

    const doc = state.doc;
    const type = 'shortcode_inline';

    doc.descendants((node, pos) => {
      if (
        node.type.name === type &&
        ['rawhtml', '/rawhtml'].includes(node.attrs.content) && node.attrs.id
      ) {
        const id = node.attrs.id;
        if (!pairs[id]) {
          pairs[id] = [];
        }
        if (node.attrs.nesting === NESTING_OPENING) {
          pairs[id][0] = { node, pos };
        }
        if (node.attrs.nesting === NESTING_CLOSING) {
          pairs[id][1] = { node, pos };
        }
      }
    });

    for (const id in pairs) {
      const open = pairs[id][0];
      const close = pairs[id][1];

      if (open && close) {
        const from = open.pos + open.node.nodeSize;
        const to = close.pos;

        const text = state.doc.textBetween(from, to, '\n').replace(/^\n/g, '');
        const codeBlockNode = schema.nodes.code_block.create(
          {
            lang: 'rawmd',
          },
          schema.text(text),
        );
        tr.replaceRangeWith(
          tr.mapping.map(from),
          tr.mapping.map(to),
          codeBlockNode,
        );
      }
    }

    if (dispatch) {
      dispatch(tr);
    }

    return tr.docChanged;
  };
}

function rawMarkdownMacro(): Command {
  return (state: EditorState, dispatch) => {
    const tr = state.tr;
    const schema = state.schema;

    const doc = state.doc;
    const type = 'code_block';

    doc.descendants((node, pos) => {
      if (node.type.name === type) {
        let textContent = node.textContent;

        let emptyStart = textContent.match(/^([\s]*)/m);
        if (emptyStart) {
          textContent = textContent.substring(emptyStart[0].length);
        }

        let rawMd = '';

        let retry = true;
        while (retry) {
          retry = false;

          let pos1 = textContent.indexOf('{{markdown}}');
          if (pos1 === 0) {
            let pos2 = textContent.indexOf('{{/markdown}}', pos1);
            if (pos2 > -1) {
              const text = textContent.substring(
                pos1 + '{{markdown}}'.length,
                pos2,
              );
              rawMd += (rawMd ? ' ' : '') + text;

              textContent = textContent.substring(pos2 + '{{/markdown}}'.length)
                .trim();
              retry = true;
            }
          }
        }

        if (rawMd) {
          const codeBlockNode = schema.nodes.code_block.create(
            {
              lang: 'rawmd',
            },
            schema.text(rawMd),
          );
          tr.insert(tr.mapping.map(pos), codeBlockNode);
        }

        if (textContent !== node.textContent) {
          if (!textContent.trim()) {
            tr.replace(
              tr.mapping.map(pos),
              tr.mapping.map(pos + node.nodeSize),
            );
          } else {
            const from = pos + 1;
            const to = from + node.content.size;
            if (emptyStart) {
              textContent = emptyStart[1] + textContent;
            }
            tr.replaceRangeWith(
              tr.mapping.map(from),
              tr.mapping.map(to),
              schema.text(textContent),
            );
          }
        }
      }
    });

    if (dispatch) {
      dispatch(tr);
    }

    return tr.docChanged;
  };
}

export function replaceUrlsWithIds(text: string): string {
  text = text.replaceAll(
    'https://drive.google.com/open?id%3D',
    'https://drive.google.com/open?id=',
  );
  text = text.replaceAll('https://drive.google.com/open?id=', 'gdoc:');
  return text;
}

export interface RewriteRule {
  tag?: string;
  match: RegExp;
  replace?: string;
  mdTemplate?: string;
  // mode?: string;
}

interface Opts {
  debug?: boolean;
  rewriteRules?: RewriteRule[];
}

function extractShortcodesFromCodeblock(tr: Transaction, schema: Schema) {
  const codeblockType = schema.nodes.code_block;
  const paragraphType = schema.nodes.paragraph;
  const shortcodeType = schema.nodes.shortcode_inline;

  tr.doc.descendants((node, pos) => {
    if (node.type !== codeblockType) return true;

    const lines = node.textContent.split('\n');
    const emptyEnding = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i] !== '') {
        break;
      }
      emptyEnding.push(lines[i]);
    }
    emptyEnding.reverse();
    lines.splice(lines.length - emptyEnding.length);

    let firstShortcode = undefined;
    let lastShortcode = undefined;

    if (/^\s*\{\{[^}]+}\}\s*$/.test(lines[0])) {
      firstShortcode = lines.shift()!.trim();
    }

    if (lines.length && /^\s*\{\{[^}]+}\}\s*$/.test(lines[lines.length - 1])) {
      lastShortcode = lines.pop()!.trim();
    }

    if (!firstShortcode && !lastShortcode) return true;

    const newCodeblock = codeblockType.create(
      node.attrs,
      schema.text(lines.concat(emptyEnding).join('\n')),
    );

    const nodesToInsert = [];

    if (firstShortcode) {
      nodesToInsert.push(
        paragraphType.create(
          {},
          shortcodeType.create({
            content: firstShortcode.substring(2, firstShortcode.length - 2),
          }),
        ),
      );
    }

    nodesToInsert.push(newCodeblock);

    if (lastShortcode) {
      nodesToInsert.push(
        paragraphType.create(
          {},
          shortcodeType.create({
            content: lastShortcode.substring(2, lastShortcode.length - 2),
          }),
        ),
      );
    }

    tr.replaceWith(
      // pos, node.nodeSize,
      tr.mapping.map(pos),
      tr.mapping.map(pos + node.nodeSize),
      nodesToInsert,
    );

    return true;
  });

  return tr;
}

export const createMiePlugin = () => {
  return new Plugin({
    appendTransaction(
      transactions: readonly Transaction[],
      oldState,
      newState,
    ) {
      return extractShortcodesFromCodeblock(newState.tr, newState.schema);
    },
  });
};

class MieExtension extends Extension {
  name = 'mie';

  override getProseMirrorPlugins(): Plugin[] {
    return [
      createMiePlugin(),
    ];
  }
}

export function wgdTest(odtName: string, opts: Opts = {}) {
  Deno.test(odtName, async (ctx: Deno.TestContext) => {
    try {
      const mdName = odtName.replace(/\.odt$/, '.md');
      const pmName = odtName.replace(/\.odt$/, '.pm');

      const serializerDebug = undefined;
      const extMd = new ExtensionMarkdown({
        debugTokens: opts.debug,
        serializerDebug,
        assetLoad,
      });

      extMd.urlToRewriter = async (url: string, ctx: UrlRewriteContext) => {
        if (!opts.rewriteRules) {
          return url;
        }

        for (const rule of opts.rewriteRules) {
          if (!rule.tag || ctx.type === rule.tag) {
            if (rule.match) {
              const matchRegExp = new RegExp(rule.match);
              const matches = matchRegExp.exec(url);
              if (matches) {
                if (rule.mdTemplate) {
                  ctx.setMeta?.('mdTemplate', rule.mdTemplate);
                }
                if (rule.replace) {
                  let newUrl = rule.replace;
                  const vals = Array.from(matches.values());
                  for (let i = vals.length - 1; i >= 0; i--) {
                    newUrl = newUrl.replace('$' + i, vals[i]);
                  }
                  return newUrl;
                }
              }
            }
          }
        }

        return url;
      };

      const extOdt = new ExtensionOdt({
        debug: opts.debug,
        postProcessCommands: [],
      });

      extOdt.urlFromRewriter = async (href, ctx) => {
        const id = urlToFolderId(href);
        if (id) {
          href = 'gdoc:' + id;
        }
        if (ctx.type === 'IMG') {
          href = href.replace(/^Pictures\//, '');
        }
        return href;
      };

      const editor = CoreEditor.create({
        assetLoad,
        editorKits: [
          new BrowserLessEditorKit(),
          {
            getExtensions() {
              return [
                extMd,
                extOdt,
                new MieExtension(),
              ];
            },
          },
        ],
        hooks: {
          'pm2md.pre': [
            ...getDefaultsPreProcessFilters({
              urlRewriter: extMd.urlToRewriter,
            }),
            rawHtmlMacro(),
            rawMarkdownMacro(),
          ],
        },
      });

      const input = Deno.readFileSync(__dirname + '/' + odtName);

      editor.addEventListener(
        'odt:parsed',
        ((event: CustomEvent) => {
          const { stylesTree, contentTree, filesMap } = event.detail;
          Deno.writeTextFileSync(
            __dirname + '/' + odtName + '.content.debug.json',
            JSON.stringify(contentTree, null, 2),
          );
        }) as EventListener,
      );

      editor.addEventListener(
        'odt:pmdoc',
        ((event: CustomEvent) => {
          const { doc } = event.detail;
          Deno.writeTextFileSync(
            __dirname + '/' + pmName + '.0.debug.json',
            JSON.stringify(doc, null, 2),
          );
        }) as EventListener,
      );

      editor.addEventListener(
        'odt:pmdoc:filtered',
        ((event: CustomEvent) => {
          const { doc } = event.detail;
          Deno.writeTextFileSync(
            __dirname + '/' + pmName + '.odtfiltered.debug.json',
            JSON.stringify(doc, null, 2),
          );
        }) as EventListener,
      );

      editor.addEventListener(
        'md:tokens',
        ((event: CustomEvent) => {
          const { tokens } = event.detail;
          Deno.writeTextFileSync(
            __dirname + '/' + mdName + '.tokens.debug.json',
            JSON.stringify(tokens, null, 2),
          );
        }) as EventListener,
      );

      await editor.loadDocument(
        'application/vnd.oasis.opendocument.text',
        input,
      );

      if (opts.debug) {
        const doc = editor.getDocument();
        const json = doc.toJSON();
        Deno.writeTextFileSync(
          __dirname + '/' + pmName + '.debug.json',
          JSON.stringify(json, null, 2),
        );
        Deno.writeTextFileSync(
          __dirname + '/' + pmName + '.debug.txt',
          nodeToTreeString(doc),
        );
      }

      const buffer = await editor.saveDocument('text/x-markdown');
      const md = new TextDecoder().decode(buffer);

      const referenceMd = new TextDecoder().decode(
        Deno.readFileSync(__dirname + '/' + mdName),
      );

      if (opts.debug) {
        Deno.writeTextFileSync(
          __dirname + '/' + pmName + '.debug.md',
          md,
        );
      }

      assertEquals(md, referenceMd);
    } catch (err: any) {
      if ('cause' in err) {
        // console.error(err.cause);
        throw err;
      }
      throw err;
    }
  });
}
