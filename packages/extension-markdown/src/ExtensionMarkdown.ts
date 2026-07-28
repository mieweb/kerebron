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

export interface MdConfig {
  sourceMap?: boolean;
  dispatchSourceMap?: boolean;
  debugTokens?: boolean;
  serializerDebug?: (...args: any[]) => void;
  assetLoad?: AssetLoad;
  urlRewriter?: UrlRewriter;
  hooks?: HookArray;
  frontmatter?: FrontmatterService;
}

export type HookArray = Array<Command | AsyncCommand>;
export type HookMap = Record<string, HookArray>;

export type { Token };
export type { MarkdownResult };

export class ExtensionMarkdown extends Extension {
  name = 'markdown';

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
          return pmToMdConverter(
            source,
            {
              assetLoad: this.editor.config.assetLoad,
              ...this.config,
              urlRewriter: markdownState.urlToRewriter,
              hooks: markdownState.hooks['pm2md.pre'],
              frontmatter: editor.ci.resolve(
                'frontmatter',
              ) as FrontmatterService,
            },
            schema,
            editor,
          );
        },
        toDoc: (source: Uint8Array) => {
          const markdownState = MarkdownPluginKey.getState(editor.state)!;
          return mdToPmConverter(source, {
            assetLoad: this.editor.config.assetLoad,
            ...this.config,
            urlRewriter: markdownState.urlFromRewriter,
            hooks: markdownState.hooks['md2pm.post'],
            frontmatter: editor.ci.resolve('frontmatter') as FrontmatterService,
          }, schema);
        },
      },
    };
    converters['text/markdown'] = converters['text/x-markdown'];
    return converters;
  }

  toMarkdown(source: Node): Promise<MarkdownResult> {
    return extPmToMdConverter(
      source,
      {
        sourceMap: true,
        frontmatter: this.editor.ci.resolve(
          'frontmatter',
        ) as FrontmatterService,
      },
      this.editor.schema,
      this.editor,
    );
  }

  async fromMarkdown(source: string): Promise<Slice> {
    const doc = await mdToPmConverterText(
      source,
      { assetLoad: this.editor.config.assetLoad, ...this.config },
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
}
