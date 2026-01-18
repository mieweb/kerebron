import { Attrs, Fragment, Node, NodeType } from 'prosemirror-model';
import { canJoin, findWrapping } from 'prosemirror-transform';

import { InputRule } from './InputRulesPlugin.ts';
import { Command } from '../../commands/types.ts';
import { Transaction } from 'prosemirror-state';

/// Build an input rule for automatically wrapping a textblock when a
/// given string is typed. The `regexp` argument is
/// directly passed through to the `InputRule` constructor. You'll
/// probably want the regexp to start with `^`, so that the pattern can
/// only occur at the start of a textblock.
///
/// `nodeType` is the type of node to wrap in. If it needs attributes,
/// you can either pass them directly, or pass a function that will
/// compute them from the regular expression match.
///
/// By default, if there's a node with the same type above the newly
/// wrapped node, the rule will try to [join](#transform.Transform.join) those
/// two nodes. You can pass a join predicate, which takes a regular
/// expression match and the node before the wrapped node, and can
/// return a boolean to indicate whether a join should happen.
export function wrappingInputRule(
  regexp: RegExp,
  nodeType: NodeType,
  getAttrs: Attrs | null | ((matches: RegExpMatchArray) => Attrs | null) = null,
  joinPredicate?: (match: RegExpMatchArray, node: Node) => boolean,
) {
  return new InputRule(regexp, (tr, state, match, start, end) => {
    if (!tr) {
      tr = state.tr;
    }
    const attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;
    tr = tr.delete(start, end);
    const $start = tr.doc.resolve(start);
    const range = $start.blockRange();
    const wrapping = range && findWrapping(range, nodeType, attrs);
    if (!wrapping) return null;
    tr.wrap(range!, wrapping);
    const before = tr.doc.resolve(start - 1).nodeBefore;
    if (
      before && before.type == nodeType && canJoin(tr.doc, start - 1) &&
      (!joinPredicate || joinPredicate(match, before))
    ) {
      tr.join(start - 1);
    }
    return tr;
  });
}

/// Build an input rule that changes the type of a textblock when the
/// matched text is typed into it. You'll usually want to start your
/// regexp with `^` to that it is only matched at the start of a
/// textblock. The optional `getAttrs` parameter can be used to compute
/// the new node's attributes, and works the same as in the
/// `wrappingInputRule` function.
export function textblockTypeInputRule(
  regexp: RegExp,
  nodeType: NodeType,
  getAttrs: Attrs | null | ((match: RegExpMatchArray) => Attrs | null) = null,
) {
  return new InputRule(regexp, (tr, state, match, start, end) => {
    if (!tr) {
      tr = state.tr;
    }
    const $start = state.doc.resolve(start);
    const attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;
    if (
      !$start.node(-1).canReplaceWith(
        $start.index(-1),
        $start.indexAfter(-1),
        nodeType,
      )
    ) return null;
    return tr
      .delete(start, end)
      .setBlockType(start, start, nodeType, attrs);
  });
}

export function commandInputRule(
  regexp: RegExp,
  command: Command,
  getAttrs: Attrs | null | ((match: RegExpMatchArray) => Attrs | null) = null,
) {
  return new InputRule(regexp, (tr, state, match, start, end) => {
    if (!tr) {
      tr = state.tr;
    }
    const $start = state.doc.resolve(start);

    const dispatch = (newTr: Transaction) => {
      tr = newTr;
      state = state.apply(tr);
    };

    dispatch(tr.delete(start, end));
    command(state, dispatch);

    return tr;
  });
}

export function replaceInlineNode(
  regexp: RegExp,
  nodeType: NodeType,
  getAttrs: Attrs | null | ((matches: RegExpMatchArray) => Attrs | null) = null,
) {
  return new InputRule(regexp, (tr, state, match, start, end) => {
    if (!tr) {
      tr = state.tr;
    }

    const attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;

    const $pos = state.doc.resolve(start);
    if ($pos.parent.type === state.schema.nodes.code_block) {
      return tr;
    }

    const node = nodeType.createAndFill(attrs);

    const from = tr.mapping.map(start);
    const to = tr.mapping.map(end);

    return tr.replaceWith(from, to, Fragment.from(node));
  });
}
