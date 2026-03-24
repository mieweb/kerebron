import type { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { CoreEditor } from '@kerebron/editor';

interface CommandContext {
  editor: CoreEditor;
}

declare type Command = {
  (
    this: CommandContext | undefined,
    state: EditorState,
    dispatch?: (tr: Transaction) => void,
    view?: EditorView,
  ): boolean;

  displayName?: string;
  description?: string;
};

export type { Command };

export type CommandFactory = (...args: any[]) => Command;

declare type AsyncCommand = {
  (
    this: CommandContext | undefined,
    state: EditorState,
    dispatch?: (tr: Transaction) => void,
    view?: EditorView,
  ): Promise<boolean>;

  displayName?: string;
  description?: string;
};

export type { AsyncCommand };

export type AsyncCommandFactory = (...args: any[]) => AsyncCommand;

export interface Commands {
  [name: string]: Command;
}

export interface CommandFactories {
  [name: string]: CommandFactory;
}

export type CommandShortcuts = {
  [name: string]: string;
};

export type ChainedCommands =
  & {
    [Item in keyof Commands]: (...args: unknown[]) => ChainedCommands;
  }
  & {
    run: () => boolean;
  };
