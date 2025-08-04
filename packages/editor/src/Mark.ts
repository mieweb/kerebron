import type { MarkSpec, MarkType } from 'prosemirror-model';

import type { InputRule } from './plugins/input-rules/InputRulesPlugin.ts';
import type { CoreEditor } from './CoreEditor.ts';
import type { CommandFactories, CommandShortcuts } from './commands/mod.ts';
import { Attribute } from './types.ts';

export interface MarkConfig {
  // @ts-ignore - this is a dynamic key
  [key: string]: any;
}

export abstract class Mark {
  readonly type = 'mark';
  name: string = 'node';

  public readonly attributes: Record<string, Attribute<any>> = {};

  public constructor(protected config: Partial<MarkConfig> = {}) {}

  getMarkSpec(): MarkSpec {
    throw new Error('MarkSpec not defined: ' + this.name);
  }

  getInputRules(type: MarkType): InputRule[] {
    return [];
  }

  getCommandFactories(
    editor: CoreEditor,
    type: MarkType,
  ): Partial<CommandFactories> {
    return {};
  }

  getKeyboardShortcuts(editor: CoreEditor): Partial<CommandShortcuts> {
    return {};
  }
}
