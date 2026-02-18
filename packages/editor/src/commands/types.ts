import type {
  Command as PmCommand,
  EditorState,
  Transaction,
} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

interface Command extends PmCommand {
  displayName?: string;
  description?: string;
}

export type { Command };

export type CommandFactory = (...args: any[]) => Command;

export type AsyncCommand = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  view?: EditorView,
) => Promise<boolean>;
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
