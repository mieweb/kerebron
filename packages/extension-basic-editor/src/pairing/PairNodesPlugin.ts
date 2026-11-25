import { Plugin, Transaction } from 'prosemirror-state';
import { ReplaceAroundStep, ReplaceStep } from 'prosemirror-transform';
import { buildPairingTransaction } from './pairNodes.ts';

export const createPairingPlugin = (types: string[]) => {
  return new Plugin({
    appendTransaction(
      transactions: readonly Transaction[],
      oldState,
      newState,
    ) {
      const typesToRebuild: Set<string> = new Set();

      for (const tr of transactions) {
        if (!tr.docChanged) continue;

        for (let idx = 0; idx < tr.steps.length; idx++) {
          const step = tr.steps[idx];
          const doc = tr.docs[idx];
          if (
            !(step instanceof ReplaceStep || step instanceof ReplaceAroundStep)
          ) {
            continue;
          }

          if (step.slice) {
            step.slice.content.descendants((node) => {
              if (types.includes(node.type.name)) {
                typesToRebuild.add(node.type.name);
              }
            });
          }

          if (step.from != null && step.to != null && step.from !== step.to) {
            doc.nodesBetween(step.from, step.to, (node) => {
              if (types.includes(node.type.name)) {
                typesToRebuild.add(node.type.name);
              }
            });
          }

          if (typesToRebuild.size === types.length) break;
        }

        if (typesToRebuild.size === types.length) break;
      }

      if (typesToRebuild.size === 0) return null;

      const tr = newState.tr;
      for (const type of typesToRebuild) {
        buildPairingTransaction(newState, type, tr);
      }

      return tr;
    },
  });
};
