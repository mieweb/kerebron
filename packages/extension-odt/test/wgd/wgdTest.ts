import { assertEquals } from '@std/assert';
import { Plugin, Transaction } from 'prosemirror-state';

import {
  CoreEditor,
  Extension,
  nodeToTreeString,
  UrlRewriteContext,
} from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { denoCdn } from '@kerebron/wasm/deno';

import { urlToFolderId } from './idParsers.ts';
import { Schema } from 'prosemirror-model';

const __dirname = import.meta.dirname;

export interface RewriteRule {
  tag?: string;
  match: RegExp;
  replace?: string;
  // template: string;
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
        cdnUrl: denoCdn(),
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
              if (matches && rule.replace) {
                let newUrl = rule.replace;
                const vals = Array.from(matches.values());
                for (let i = vals.length - 1; i >= 1; i--) {
                  newUrl = newUrl.replace('$' + i, vals[i]);
                }
                return newUrl;
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

      const editor = CoreEditor.create({
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
      });

      extOdt.urlFromRewriter = async (href, ctx) => {
        if (ctx.type === 'A') {
          const id = urlToFolderId(href);
          if (id) {
            href = 'gdoc:' + id;
          }
        }
        if (ctx.type === 'IMG') {
          href = href.replace(/^Pictures\//, '');
        }
        return href;
      };

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
            __dirname + '/' + pmName + '.9.debug.json',
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
