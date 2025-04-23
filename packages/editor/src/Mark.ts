import { MarkSpec, MarkType } from 'prosemirror-model';

import { InputRule } from './plugins/input-rules/InputRulesPlugin.ts';
import { CoreEditor } from './CoreEditor.ts';
import { Commands, CommandShortcuts } from './commands/mod.ts';

export interface MarkConfig {
  // @ts-ignore - this is a dynamic key
  [key: string]: any;
}

export abstract class Mark {
  readonly type = 'mark';
  name: string = 'node';

  public constructor(protected config: Partial<MarkConfig> = {}) {}

  getMarkSpec(): MarkSpec {
    throw new Error('MarkSpec not defined: ' + this.name);
  }

  getInputRules(type: MarkType): InputRule[] {
    return [];
  }

  getCommands(editor: CoreEditor, type: MarkType): Partial<Commands> {
    return {};
  }

  getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {};
  }
}
