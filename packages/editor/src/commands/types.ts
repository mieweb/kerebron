import type { Command as PmCommand } from 'prosemirror-state';

interface Command extends PmCommand {
  displayName?: string;
  description?: string;
}

export type { Command };

export type CommandFactory = (...args: any[]) => Command;

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
