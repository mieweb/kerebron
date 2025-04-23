import { Plugin } from 'prosemirror-state';

import { type CoreEditor } from './CoreEditor.ts';
import { InputRule } from './plugins/input-rules/InputRulesPlugin.ts';
import { Commands, CommandShortcuts } from './commands/mod.ts';
import { Schema, type SchemaSpec } from 'prosemirror-model';

export interface ExtensionConfig {
  // @ts-ignore - this is a dynamic key
  [key: string]: any;

  requires: Array<Extension | string>;
}

export interface Converter {
  fromDoc(document: unknown): void;
  toDoc(content: unknown): any;
}

export abstract class Extension {
  readonly type = 'extension';
  abstract name: string;

  protected constructor(protected config: Partial<ExtensionConfig> = {}) {
  }

  getInputRules(): InputRule[] {
    return [];
  }

  getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    return [];
  }

  getCommands(editor: CoreEditor): Partial<Commands> {
    return {};
  }

  getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {};
  }

  getConverters(): Record<string, Converter> {
    return {};
  }

  setupSpec(spec: SchemaSpec) {
  }
}
