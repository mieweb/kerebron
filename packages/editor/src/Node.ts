import type { NodeSpec, NodeType, Schema } from 'prosemirror-model';
import type { NodeViewConstructor } from 'prosemirror-view';
import type { Plugin } from 'prosemirror-state';

import type { InputRule } from './plugins/input-rules/InputRulesPlugin.ts';
import type { CoreEditor } from './CoreEditor.ts';
import type { Command, CommandShortcuts } from './commands/mod.ts';
import type { Converter } from './Extension.ts';
import { Attribute } from './types.ts';

export interface NodeConfig {
  // @ts-ignore - this is a dynamic key
  [key: string]: any;
}

export interface CommandFactories {
  [key: string]: () => Command;
}

export abstract class Node {
  readonly type = 'node';
  name: string = 'node';

  public readonly attributes: Record<string, Attribute<any>> = {};

  public constructor(protected config: Partial<NodeConfig> = {}) {}

  getNodeSpec(): NodeSpec {
    throw new Error('NodeSpec not defined: ' + this.name);
  }

  getInputRules(type: NodeType): InputRule[] {
    return [];
  }

  getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    return [];
  }

  getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {};
  }

  getKeyboardShortcuts(editor: CoreEditor): Partial<CommandShortcuts> {
    return {};
  }

  getNodeView(): NodeViewConstructor | undefined {
    return undefined;
  }

  getConverters(editor: CoreEditor, schema: Schema): Record<string, Converter> {
    return {};
  }
}
