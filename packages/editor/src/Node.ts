import { NodeSpec, NodeType } from 'prosemirror-model';
import { NodeViewConstructor } from 'prosemirror-view';
import { Plugin } from 'prosemirror-state';

import { InputRule } from './plugins/input-rules/InputRulesPlugin.ts';
import { CoreEditor } from './CoreEditor.ts';
import { Command, Commands, CommandShortcuts } from './commands/mod.ts';
import { Converter } from './Extension.ts';

export interface NodeConfig {
  // @ts-ignore - this is a dynamic key
  [key: string]: any;
}

export interface CommandConstructors {
  [key: string]: () => Command;
}

export abstract class Node {
  readonly type = 'node';
  name: string = 'node';

  public constructor(protected config: Partial<NodeConfig> = {}) {}

  getNodeSpec(): NodeSpec {
    throw new Error('NodeSpec not defined: ' + this.name);
  }

  getInputRules(type: NodeType): InputRule[] {
    return [];
  }

  getProseMirrorPlugins(editor: CoreEditor): Plugin[] {
    return [];
  }

  getCommands(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandConstructors> {
    return {};
  }

  getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {};
  }

  getNodeView(): NodeViewConstructor | undefined {
    return undefined;
  }

  getConverters(): Record<string, Converter> {
    return {};
  }
}
