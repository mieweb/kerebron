import { assertEquals } from '@std/assert';

import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { denoCdn } from '@kerebron/wasm/deno';
import { urlToFolderId } from './idParsers.ts';

const __dirname = import.meta.dirname;

interface Opts {
  debug?: boolean;
}

export function wgdTest(odtName: string, opts: Opts) {
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
      const extOdt = new ExtensionOdt({
        debug: opts.debug,
        postProcessCommands: [],
      });

      const editor = CoreEditor.create({
        editorKits: [
          {
            getExtensions() {
              return [
                extMd,
                extOdt,
              ];
            },
          },
          new BrowserLessEditorKit(),
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
        const json = editor.getDocument().toJSON();
        Deno.writeTextFileSync(
          __dirname + '/' + pmName + '.debug.json',
          JSON.stringify(json, null, 2),
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
