import type { Plugin } from 'prosemirror-state';
import type { Node, Schema, SchemaSpec } from 'prosemirror-model';

import { type CoreEditor } from './CoreEditor.ts';
import type { InputRule } from './plugins/input-rules/InputRulesPlugin.ts';
import { CommandFactories, CommandShortcuts } from './commands/mod.ts';

export interface ExtensionConfig {
  // @ts-ignore - this is a dynamic key
  [key: string]: any;

  requires: Array<Extension | string>;
}

export interface Converter {
  fromDoc(document: Node): Promise<Uint8Array>;
  toDoc(content: Uint8Array): Promise<Node>;
}

export abstract class Extension {
  readonly type = 'extension';
  abstract name: string;

  public constructor(protected config: Partial<ExtensionConfig> = {}) {
  }

  getInputRules(): InputRule[] {
    return [];
  }

  getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    return [];
  }

  getCommandFactories(editor: CoreEditor): Partial<CommandFactories> {
    return {};
  }

  getKeyboardShortcuts(editor: CoreEditor): Partial<CommandShortcuts> {
    return {};
  }

  getConverters(editor: CoreEditor, schema: Schema): Record<string, Converter> {
    return {};
  }

  setupSpec(spec: SchemaSpec) {
  }
}
