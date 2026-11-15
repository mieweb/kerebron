import type { EditorState, Plugin, Transaction } from 'prosemirror-state';

import { CommandFactories, Extension } from '@kerebron/editor';
import { CommandFactory } from '@kerebron/editor/commands';

import { HoverPlugin, HoverPluginKey } from './HoverPlugin.ts';
import { HoverConfig, HoverSource } from './types.ts';

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /**
     * Register a hover source with the hover plugin.
     *
     * @param hoverSource Matcher plus request processor.
     */
    addHoverSource: (hoverSource: HoverSource) => ReturnType;
  }
}

export class ExtensionHover extends Extension {
  name = 'hover';

  public constructor(
    public override config: HoverConfig = {},
  ) {
    super(config);
  }

  override getCommandFactories(): Partial<CommandFactories> {
    const addHoverSource: CommandFactory = (
      hoverSource: HoverSource,
    ) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(HoverPluginKey, {
          addHoverSource: { hoverSource },
        });

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    return {
      addHoverSource,
    };
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      new HoverPlugin(this.config, this.editor),
    ];
  }
}
