import type { Node, Schema } from 'prosemirror-model';
import { type Converter, type CoreEditor, Extension } from '@kerebron/editor';

import {
  MarkdownResult,
  pmToMdConverter,
  syncPmToMdConverter,
} from './pmToMdConverter.ts';
import { mdToPmConverter } from './mdToPmConverter.ts';
import type { Token } from './types.ts';

export interface MdConfig {
  sourceMap?: boolean;
  dispatchSourceMap?: boolean;
  debugTokens?: boolean;
}

export type { Token };

export class ExtensionMarkdown extends Extension {
  name = 'markdown';

  public constructor(protected override config: Partial<MdConfig> = {}) {
    super(config);
  }

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    return {
      'text/x-markdown': {
        fromDoc: (source: Node) =>
          pmToMdConverter(source, this.config, schema, editor),
        toDoc: (source: Uint8Array) =>
          mdToPmConverter(source, this.config, schema),
      },
    };
  }

  toMarkdown(source: Node): MarkdownResult {
    return syncPmToMdConverter(
      source,
      {
        sourceMap: true,
      },
      this.editor.schema,
      this.editor,
    );
  }
}
