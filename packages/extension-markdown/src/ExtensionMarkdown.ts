import type { Node, Schema } from 'prosemirror-model';
import { Slice } from 'prosemirror-model';
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

export interface MdConfig {
  sourceMap?: boolean;
  dispatchSourceMap?: boolean;
  debugTokens?: boolean;
  serializerDebug?: (...args: any[]) => void;
  assetLoad?: AssetLoad;
  urlRewriter?: UrlRewriter;
  moduleOptions?: object;
}

export type { Token };

export class ExtensionMarkdown extends Extension {
  name = 'markdown';
  urlFromRewriter?: UrlRewriter;
  urlToRewriter?: UrlRewriter;

  public constructor(public override config: Partial<MdConfig> = {}) {
    super(config);
  }

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    return {
      'text/x-markdown': {
        fromDoc: (source: Node) =>
          pmToMdConverter(
            source,
            {
              assetLoad: this.editor.config.assetLoad,
              ...this.config,
              urlRewriter: this.urlToRewriter,
            },
            schema,
            editor,
          ),
        toDoc: (source: Uint8Array) =>
          mdToPmConverter(source, {
            assetLoad: this.editor.config.assetLoad,
            ...this.config,
            urlRewriter: this.urlFromRewriter,
          }, schema),
      },
    };
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
    if (!this.editor.hooks['pm2md.pre']) {
      this.editor.hooks['pm2md.pre'] = getDefaultsPreProcessFilters({
        urlRewriter: this.config.urlRewriter,
      });
    }
  }
}
