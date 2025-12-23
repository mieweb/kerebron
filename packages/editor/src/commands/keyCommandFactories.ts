import { CommandFactory, firstCommand } from '@kerebron/editor/commands';
import { baseCommandFactories } from './baseCommandFactories.ts';

const backspace = firstCommand(
  baseCommandFactories.undoInputRule(),
  baseCommandFactories.deleteSelection(),
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

export const keyCommandFactories: Record<string, CommandFactory> = {
  backspace: () => backspace,
  del: () => del,
  enter: () => enter,
};
