import type { Node, Schema } from 'prosemirror-model';
import { Slice } from 'prosemirror-model';
import {
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

export interface MdConfig {
  sourceMap?: boolean;
  dispatchSourceMap?: boolean;
  debugTokens?: boolean;
  serializerDebug?: (...args: any[]) => void;
  cdnUrl?: string;
  urlRewriter?: UrlRewriter;
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
              cdnUrl: this.editor.config.cdnUrl,
              ...this.config,
              urlRewriter: this.urlToRewriter,
            },
            schema,
            editor,
          ),
        toDoc: (source: Uint8Array) =>
          mdToPmConverter(source, {
            cdnUrl: this.editor.config.cdnUrl,
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
      { cdnUrl: this.editor.config.cdnUrl, ...this.config },
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
}
