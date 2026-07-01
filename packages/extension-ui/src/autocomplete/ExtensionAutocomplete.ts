import type { EditorState, Plugin, Transaction } from 'prosemirror-state';

import { CommandFactories, Extension } from '@kerebron/editor';
import { CommandFactory } from '@kerebron/editor/commands';

import {
  AutocompletePlugin,
  AutocompletePluginKey,
} from './AutocompletePlugin.ts';
import { AutocompleteConfig, AutocompleteSource } from './types.ts';

export class ExtensionAutocomplete extends Extension {
  name = 'autocomplete';

  public constructor(
    public override config: AutocompleteConfig = {},
  ) {
    super(config);
  }

  override getCommandFactories(): Partial<CommandFactories> {
    const addAutocompleteSource: CommandFactory = (
      autocompleteSource: AutocompleteSource,
    ) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(AutocompletePluginKey, {
          addAutocompleteSource: { autocompleteSource },
        });

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    return {
      addAutocompleteSource,
    };
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      new AutocompletePlugin(this.config, this.editor),
    ];
  }
}
