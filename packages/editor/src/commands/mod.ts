import type { Transaction } from 'prosemirror-state';
import type { Node } from 'prosemirror-model';
import type { Command } from './types.ts';
import { canJoin } from 'prosemirror-transform';

export * from './types.ts';

/// Combine a number of command functions into a single function (which
/// calls them one by one until one returns true).
export function firstCommand(...commands: readonly Command[]): Command {
  const cmd: Command = function (state, dispatch, view) {
    for (let i = 0; i < commands.length; i++) {
      if (commands[i](state, dispatch, view)) {
        const cmd: Command = commands[i];
        if (cmd.displayName !== 'first') {
          console.debug(
            'firstCommand: ',
            commands[i].displayName || commands[i],
          );
        }
        return true;
      }
    }
    return false;
  };
  cmd.displayName = 'first';

  return cmd;
}

export function alternativeCommands(...commands: readonly Command[]): Command {
  return function (state, dispatch, view) {
    for (let i = 0; i < commands.length; i++) {
      if (commands[i](state, dispatch, view)) return true;
    }
    return false;
  };
}

function wrapDispatchForJoin(
  dispatch: (tr: Transaction) => void,
  isJoinable: (a: Node, b: Node) => boolean,
) {
  return (tr: Transaction) => {
    if (!tr.isGeneric) return dispatch(tr);

    let ranges: number[] = [];
    for (let i = 0; i < tr.mapping.maps.length; i++) {
      let map = tr.mapping.maps[i];
      for (let j = 0; j < ranges.length; j++) {
        ranges[j] = map.map(ranges[j]);
      }
      map.forEach((_s, _e, from, to) => ranges.push(from, to));
    }

    // Figure out which joinable points exist inside those ranges,
    // by checking all node boundaries in their parent nodes.
    let joinable = [];
    for (let i = 0; i < ranges.length; i += 2) {
      let from = ranges[i], to = ranges[i + 1];
      let $from = tr.doc.resolve(from),
        depth = $from.sharedDepth(to),
        parent = $from.node(depth);
      for (
        let index = $from.indexAfter(depth), pos = $from.after(depth + 1);
        pos <= to;
        ++index
      ) {
        let after = parent.maybeChild(index);
        if (!after) break;
        if (index && joinable.indexOf(pos) == -1) {
          let before = parent.child(index - 1);
          if (before.type == after.type && isJoinable(before, after)) {
            joinable.push(pos);
          }
        }
        pos += after.nodeSize;
      }
    }
    // Join the joinable points
    joinable.sort((a, b) => a - b);
    for (let i = joinable.length - 1; i >= 0; i--) {
      if (canJoin(tr.doc, joinable[i])) tr.join(joinable[i]);
    }
    dispatch(tr);
  };
}

/// Wrap a command so that, when it produces a transform that causes
/// two joinable nodes to end up next to each other, those are joined.
/// Nodes are considered joinable when they are of the same type and
/// when the `isJoinable` predicate returns true for them or, if an
/// array of strings was passed, if their node type name is in that
/// array.
export function autoJoin(
  command: Command,
  isJoinable: ((before: Node, after: Node) => boolean) | readonly string[],
): Command {
  let canJoin = Array.isArray(isJoinable)
    ? (node: Node) => isJoinable.indexOf(node.type.name) > -1
    : isJoinable as (a: Node, b: Node) => boolean;
  return (state, dispatch, view) =>
    command(state, dispatch && wrapDispatchForJoin(dispatch, canJoin), view);
}
