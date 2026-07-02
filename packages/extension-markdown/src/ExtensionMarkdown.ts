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
  extPmToMdConverter,
  MarkdownResult,
  pmToMdConverter,
} from './pmToMdConverter.ts';
import { mdToPmConverter, mdToPmConverterText } from './mdToPmConverter.ts';
import type { Token } from './types.ts';
import { getDefaultsPreProcessFilters } from './preprocess/preProcess.ts';
import { createMarkdownPlugin } from './createMarkdownPlugin.ts';
import {
  AsyncCommand,
  Command,
  CommandFactories,
  CommandFactory,
} from '@kerebron/editor/commands';
import { rewriteUrls } from './preprocess/rewriteUrls.ts';

export interface MdConfig {
  sourceMap?: boolean;
  dispatchSourceMap?: boolean;
  debugTokens?: boolean;
  serializerDebug?: (...args: any[]) => void;
  assetLoad?: AssetLoad;
  urlRewriter?: UrlRewriter;
  hooks?: HookArray;
}

type HookArray = Array<Command | AsyncCommand>;
type HookMap = Record<string, HookArray>;

export type { Token };
export type { MarkdownResult };

export class ExtensionMarkdown extends Extension {
  name = 'markdown';

  hooks: HookMap = {};
  urlFromRewriter?: UrlRewriter;
  urlToRewriter?: UrlRewriter;

  public constructor(public override config: Partial<MdConfig> = {}) { // TODO move all config to dynamic commands
    super(config);
  }

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    const converters: Record<string, Converter> = {
      'text/x-markdown': {
        fromDoc: (source: Node) =>
          pmToMdConverter(
            source,
            {
              assetLoad: this.editor.config.assetLoad,
              ...this.config,
              urlRewriter: this.urlToRewriter,
              hooks: this.hooks['pm2md.pre'],
            },
            schema,
            editor,
          ),
        toDoc: (source: Uint8Array) =>
          mdToPmConverter(source, {
            assetLoad: this.editor.config.assetLoad,
            ...this.config,
            urlRewriter: this.urlFromRewriter,
            hooks: this.hooks['md2pm.post'],
          }, schema),
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

  override created(): void {
    if (this.editor.schema.topNodeType.name === 'doc') {
      this.hooks['pm2md.pre'] = getDefaultsPreProcessFilters({
        getUrlRewriter: () => this.urlToRewriter,
      });
    } else {
      this.hooks['pm2md.pre'] = [];
    }
    this.hooks['md2pm.post'] = [
      rewriteUrls(() => this.urlFromRewriter),
    ];
  }

  override getCommandFactories(): Partial<CommandFactories> {
    const getMarkdownHooks: CommandFactory = (
      type: string,
      cb: (hooks: HookArray) => void,
    ) => {
      return () => {
        cb(this.hooks[type]);
        return true;
      };
    };

    const setMarkdownHooks: CommandFactory = (
      type: string,
      hooks: HookArray,
    ) => {
      return () => {
        this.hooks[type] = hooks;
        return true;
      };
    };

    const setFromMarkdownUrlRewriter: CommandFactory = (
      urlRewriter: UrlRewriter,
    ) => {
      return () => {
        this.urlFromRewriter = urlRewriter;
        return true;
      };
    };
    const setToMarkdownUrlRewriter: CommandFactory = (
      urlRewriter: UrlRewriter,
    ) => {
      return () => {
        this.urlToRewriter = urlRewriter;
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
