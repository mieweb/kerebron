import type { EditorState, Plugin, Transaction } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';

import { type CoreEditor, Extension, type TextRange } from '@kerebron/editor';

import { AutocompletePlugin } from './AutocompletePlugin.ts';
import { AutocompleteMatcher, AutocompleteRenderer } from './types.ts';

export interface AutocompleteProps {
  state: EditorState;
  range: TextRange;
  isActive?: boolean;
}

export interface AutocompleteConfig<I = any, TSelected = any> {
  getItems: (query: string, props: AutocompleteProps) => I[] | Promise<I[]>;

  onSelect?: (selected: TSelected, range: TextRange) => void;
  allow?: (
    props: AutocompleteProps,
  ) => boolean;

  matchers?: AutocompleteMatcher[];
  renderer?: AutocompleteRenderer<I, TSelected>;

  decorationTag?: string;
  decorationClass?: string;
}

export class ExtensionAutocomplete extends Extension {
  name = 'autocomplete';
  plugin!: AutocompletePlugin<unknown, unknown>;

  public constructor(
    protected override config: AutocompleteConfig,
  ) {
    super(config);
  }

  override getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    return [
      new AutocompletePlugin(this.config, editor),
    ];
  }
}
