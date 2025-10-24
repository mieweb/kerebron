import type { EditorView } from 'prosemirror-view';
import type { EditorState, Transaction } from 'prosemirror-state';

import type { CoreEditor } from '../CoreEditor.ts';
import { createChainableState } from './createChainableState.ts';
import type {
  ChainedCommands,
  Command,
  CommandFactories,
  CommandFactory,
} from './types.ts';

import { baseCommandFactories } from './baseCommandFactories.ts';
import { keyCommandFactories } from './keyCommandFactories.ts';
import { replaceCommandFactories } from './replaceCommandFactories.ts';

type CommandRunner = () => void;

export class CommandManager {
  public readonly commandFactories: { [key: string]: CommandFactory } = {};
  public readonly run: { [key: string]: CommandRunner } = {};

  private debug = true;

  constructor(
    private editor: CoreEditor,
  ) {
    this.mergeCommandFactories(baseCommandFactories, 'baseCommand');
    this.mergeCommandFactories(keyCommandFactories, 'key');
    this.mergeCommandFactories(replaceCommandFactories, 'replace');
  }

  public mergeCommandFactories(
    toInsert: Partial<CommandFactories>,
    extName: string,
  ) {
    for (const key in toInsert) {
      const commandFactory = toInsert[key];
      if (!commandFactory) {
        continue;
      }

      if (this.debug) {
        const wrappedFactory = (...args: unknown[]) => {
          const realCommand = commandFactory(...args);

          const command: Command = (state, dispatch, view) => {
            if (dispatch) {
              console.debug(`Command: ${extName}.${key}`);
            }
            return realCommand(state, dispatch, view);
          };

          return command;
        };

        this.commandFactories[key] = wrappedFactory;
      } else {
        this.commandFactories[key] = commandFactory;
      }
    }

    for (const key in this.commandFactories) {
      const factory = this.commandFactories[key];

      this.run[key] = (...args) => {
        const command: Command = factory(...args);
        const state = this.editor.state;
        const view = this.editor.view;
        if (view instanceof EditorView) {
          command(state, view.dispatch, view);
        } else {
          command(state, view.dispatch);
        }
      };
    }
  }

  get state(): EditorState {
    return this.editor.state;
  }

  get chain(): () => ChainedCommands {
    return () => this.createChain();
  }

  get can(): () => ChainedCommands {
    return () => this.createCan();
  }

  public createChain(
    startTr?: Transaction,
    shouldDispatch = true,
  ): ChainedCommands {
    const { commandFactories, editor, state } = this;
    const { view } = editor;
    const callbacks: boolean[] = [];
    const hasStartTransaction = !!startTr;
    const tr = startTr || state.tr;

    const chainedState = createChainableState(tr, state);
    const fakeDispatch = () => undefined;

    const chain = {
      ...Object.fromEntries(
        Object.entries(commandFactories).map(([name, commandFactory]) => {
          const chainedCommand = (...args: never[]) => {
            const command = commandFactory(...args);
            const callback = command(
              chainedState,
              shouldDispatch ? fakeDispatch : undefined,
            );
            callbacks.push(callback);
            return chain;
          };
          return [name, chainedCommand];
        }),
      ),
      run: () => {
        if (
          !hasStartTransaction &&
          shouldDispatch &&
          !tr.getMeta('preventDispatch')
        ) {
          view.dispatch(tr);
        }

        return callbacks.every((callback) => callback === true);
      },
      chain: () => {
        return this.createChain(tr, shouldDispatch);
      },
    } as unknown as ChainedCommands;

    return chain;
  }

  public createCan(startTr?: Transaction): ChainedCommands {
    return this.createChain(startTr, false);
  }
}
