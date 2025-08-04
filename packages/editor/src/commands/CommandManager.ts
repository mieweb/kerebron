import { type Command, EditorState, Transaction } from 'prosemirror-state';
import { CoreEditor } from '../CoreEditor.ts';
import { createChainableState } from './createChainableState.ts';
import { ChainedCommands, CommandFactory } from './mod.ts';

export class CommandManager {
  constructor(
    private editor: CoreEditor,
    private commandFactories: { [key: string]: CommandFactory } = {},
  ) {
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
