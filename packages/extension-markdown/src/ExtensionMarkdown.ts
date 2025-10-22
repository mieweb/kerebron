import type { Node, Schema } from 'prosemirror-model';
import { type Converter, type CoreEditor, Extension } from '@kerebron/editor';

import pmToMdConverter from './pmToMdConverter.ts';
import mdToPmConverter from './mdToPmConverter.ts';

export interface MdConfig {
  sourceMap?: boolean;
  debugTokens?: boolean;
}

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
}
