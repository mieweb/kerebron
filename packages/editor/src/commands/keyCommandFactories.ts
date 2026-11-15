import { CommandFactory, firstCommand } from '@kerebron/editor/commands';
import { baseCommandFactories } from './baseCommandFactories.ts';

const backspace = firstCommand(
  baseCommandFactories.undoInputRule(),
  baseCommandFactories.deleteSelection(),
  baseCommandFactories.liftListItemParagraph(),
  baseCommandFactories.joinBackward(),
  baseCommandFactories.selectNodeBackward(),
);
const del = firstCommand(
  baseCommandFactories.deleteSelection(),
  baseCommandFactories.joinForward(),
  baseCommandFactories.selectNodeForward(),
);
const enter = firstCommand(
  baseCommandFactories.newlineInCode(),
  baseCommandFactories.createParagraphNear(),
  baseCommandFactories.liftEmptyBlock(),
  baseCommandFactories.splitBlock(),
);

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /** Handle Backspace: undo input rule, delete selection, join/lift backward. */
    backspace: () => ReturnType;
    /** Handle Delete: delete selection, join/select forward. */
    del: () => ReturnType;
    /** Handle Enter: newline in code, create paragraph, lift empty block, split block. */
    enter: () => ReturnType;
  }
}

export const keyCommandFactories: Record<string, CommandFactory> = {
  backspace: () => backspace,
  del: () => del,
  enter: () => enter,
};
