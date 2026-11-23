import type { Node, Schema } from 'prosemirror-model';
import { Slice } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';

import {
  AssetLoad,
  type Converter,
  type CoreEditor,
  Extension,
  type UrlRewriter,
} from '@kerebron/editor';
import {
  AsyncCommand,
  Command,
  CommandFactories,
  CommandFactory,
} from '@kerebron/editor/commands';
import { FrontmatterService } from '@kerebron/editor/frontmatter';

import {
  extPmToMdConverter,
  MarkdownResult,
  pmToMdConverter,
} from './pmToMdConverter.ts';
import { mdToPmConverter, mdToPmConverterText } from './mdToPmConverter.ts';
import type { Token } from './types.ts';
import {
  createMarkdownPlugin,
  MarkdownPluginKey,
} from './createMarkdownPlugin.ts';
import { sitterTokenizer } from './treeSitterTokenizer.ts';
import { Telemetry } from '@kerebron/editor/Telemetry';

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /**
     * Read the hooks registered for a markdown hook type.
     *
     * @param type Hook type, e.g. `pm2md.pre`.
     * @param cb Called with the registered hooks (`[]` if none).
     */
    getMarkdownHooks: (
      type: string,
      cb: (hooks: HookArray) => void,
    ) => ReturnType;
    /**
     * Replace the hooks for a markdown hook type.
     *
     * @param type Hook type, e.g. `pm2md.pre`.
     * @param hooks Hook functions to register.
     */
    setMarkdownHooks: (type: string, hooks: HookArray) => ReturnType;
    /**
     * Set the URL rewriter applied when converting Markdown to ProseMirror.
     *
     * @param urlRewriter Async rewriter receiving the URL and rewrite context.
     */
    setFromMarkdownUrlRewriter: (urlRewriter: UrlRewriter) => ReturnType;
    /**
     * Set the URL rewriter applied when converting ProseMirror to Markdown.
     *
     * @param urlRewriter Async rewriter receiving the URL and rewrite context.
     */
    setToMarkdownUrlRewriter: (urlRewriter: UrlRewriter) => ReturnType;
  }
}

export interface MdConfig {
  sourceMap?: boolean;
  serializerDebug?: (...args: any[]) => void;
  assetLoad?: AssetLoad;
  urlRewriter?: UrlRewriter;
  hooks?: HookArray;
  frontmatter?: FrontmatterService;
  tokenizer?: { parse: (source: string) => Array<Token> };
  telemetry: Telemetry;
  htmlListItems?: boolean;
  listMargins?: Record<string, number>;
}

export type HookArray = Array<Command | AsyncCommand>;
export type HookMap = Record<string, HookArray>;

export type { Token };
export type { MarkdownResult };

export class ExtensionMarkdown extends Extension {
  name = 'markdown';
  tokenizer: { parse: (source: string) => Array<Token> } | undefined;

  public constructor(public override config: Partial<MdConfig> = {}) { // TODO move all config to dynamic commands
    super(config);
  }

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    const converters: Record<string, Converter> = {
      'text/x-markdown': {
        fromDoc: (source: Node) => {
          const markdownState = MarkdownPluginKey.getState(editor.state)!;
          const telemetry: Telemetry = editor.di.resolve('telemetry')!;
          return telemetry.span('pm2md', () => {
            return pmToMdConverter(
              source,
              {
                telemetry,
                assetLoad: this.editor.config.assetLoad,
                ...this.config,
                urlRewriter: markdownState.urlToRewriter,
                hooks: markdownState.hooks['pm2md.pre'],
                frontmatter: editor.di.resolve(
                  'frontmatter',
                ) as FrontmatterService,
              },
              schema,
              editor,
            );
          });
        },
        toDoc: async (source: Uint8Array) => {
          if (!this.tokenizer && this.editor.config.assetLoad) {
            this.tokenizer = await sitterTokenizer(
              this.editor.config.assetLoad,
              this.editor.di.resolve('telemetry')!,
            );
          }

          const markdownState = MarkdownPluginKey.getState(editor.state)!;
          const telemetry: Telemetry = editor.di.resolve('telemetry')!;
          return telemetry.span('md2pm', async () => {
            return await mdToPmConverter(source, {
              telemetry,
              assetLoad: this.editor.config.assetLoad,
              tokenizer: this.tokenizer,
              ...this.config,
              urlRewriter: markdownState.urlFromRewriter,
              hooks: markdownState.hooks['md2pm.post'],
              frontmatter: editor.di.resolve(
                'frontmatter',
              ) as FrontmatterService,
            }, schema);
          });
        },
      },
    };
    converters['text/markdown'] = converters['text/x-markdown'];
    return converters;
  }

  toMarkdown(source: Node): Promise<MarkdownResult> {
    const telemetry: Telemetry = this.editor.di.resolve('telemetry')!;

    return extPmToMdConverter(
      source,
      {
        telemetry,
        sourceMap: true,
        frontmatter: this.editor.di.resolve(
          'frontmatter',
        ) as FrontmatterService,
      },
      this.editor.schema,
      this.editor,
    );
  }

  async fromMarkdown(source: string): Promise<Slice> {
    const telemetry: Telemetry = this.editor.di.resolve('telemetry')!;

    const doc = await mdToPmConverterText(
      source,
      { telemetry, assetLoad: this.editor.config.assetLoad, ...this.config },
      this.editor.schema,
    );

    const fragment = doc.content;
    if (fragment.content.length === 1) {
      const first = fragment.content[0];
      if (first.type.name === 'paragraph') {
        return new Slice(first.content, 0, 0);
      }
    }

    return new Slice(fragment, 0, 0);
  }

  override getCommandFactories(): Partial<CommandFactories> {
    const getMarkdownHooks: CommandFactory = (
      type: string,
      cb: (hooks: HookArray) => void,
    ) => {
      return (state, dispatch) => {
        const pluginState = MarkdownPluginKey.getState(state);
        if (pluginState) {
          cb(pluginState.hooks[type]);
        } else {
          cb([]);
        }
        return true;
      };
    };

    const setMarkdownHooks: CommandFactory = (
      type: string,
      hooks: HookArray,
    ) => {
      return (state, dispatch) => {
        if (dispatch) {
          dispatch(
            state.tr.setMeta(MarkdownPluginKey, {
              setMarkdownHooks: { type, hooks },
            }),
          );
        }
        return true;
      };
    };

    const setFromMarkdownUrlRewriter: CommandFactory = (
      urlRewriter: UrlRewriter,
    ) => {
      return (state, dispatch) => {
        if (dispatch) {
          dispatch(
            state.tr.setMeta(MarkdownPluginKey, {
              setFromMarkdownUrlRewriter: { urlRewriter },
            }),
          );
        }
        return true;
      };
    };
    const setToMarkdownUrlRewriter: CommandFactory = (
      urlRewriter: UrlRewriter,
    ) => {
      return (state, dispatch) => {
        if (dispatch) {
          dispatch(
            state.tr.setMeta(MarkdownPluginKey, {
              setToMarkdownUrlRewriter: { urlRewriter },
            }),
          );
        }
        return true;
      };
    };

    return {
      getMarkdownHooks,
      setMarkdownHooks,
      setFromMarkdownUrlRewriter,
      setToMarkdownUrlRewriter,
    };
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      createMarkdownPlugin(this, this.editor),
    ];
  }

  override created() {
    const snapshot = () => {
      MarkdownPluginKey.getState(this.editor.state)?.performSnapshot();
    };

    this.editor.addEventListener('doc:loaded', snapshot);
    this.editor.addEventListener('ready', snapshot, { once: true });
  }
}
