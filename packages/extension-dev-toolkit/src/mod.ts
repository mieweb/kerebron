import { applyDevTools, removeDevTools } from 'prosemirror-dev-toolkit';

import { CommandFactories, type CoreEditor, Extension } from '@kerebron/editor';
import { CommandShortcuts } from '@kerebron/editor/commands';
import { EditorView } from 'prosemirror-view';

export interface DevToolkitConfig {
}

export class ExtensionDevToolkit extends Extension {
  name = 'dev_toolkit';

  private visible = false;

  constructor(protected override config: DevToolkitConfig = {}) {
    super(config);
  }

  override getCommandFactories(editor: CoreEditor): Partial<CommandFactories> {
    const commands: CommandFactories = {
      toggleDevToolkit: () => () => {
        if (this.visible) {
          removeDevTools();
          this.visible = !this.visible;
        } else {
          if (editor.view instanceof EditorView) {
            applyDevTools(editor.view, { devToolsExpanded: true });
            this.visible = !this.visible;
          }
        }
        return true;
      },
    };
    return commands;
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    const shortcuts: CommandShortcuts = {
      'Ctrl-`': 'toggleDevToolkit',
    };
    return shortcuts;
  }
}
