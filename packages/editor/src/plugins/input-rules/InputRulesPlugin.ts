import { Node as ProseMirrorNode } from 'prosemirror-model';
import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  Transaction,
} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import type { Command, CommandFactory } from '../../commands/types.ts';

const MAX_MATCH = 500;

type PluginState = {
  transform: Transaction;
  from: number;
  to: number;
  text: string;
} | null;

/// Input rules are regular expressions describing a piece of text
/// that, when typed, causes something to happen. This might be
/// changing two dashes into an emdash, wrapping a paragraph starting
/// with `"> "` into a blockquote, or something entirely different.
export class InputRule {
  /// @internal
  handler: (
    tr: Transaction,
    state: EditorState,
    match: RegExpMatchArray,
    start: number,
    end: number,
  ) => Transaction | null;

  /// @internal
  undoable: boolean;
  inCode: boolean | 'only';

  // :: (RegExp, union<string, (state: EditorState, match: [string], start: number, end: number) → ?Transaction>)
  /// Create an input rule. The rule applies when the user typed
  /// something and the text directly in front of the cursor matches
  /// `match`, which should end with `$`.
  ///
  /// The `handler` can be a string, in which case the matched text, or
  /// the first matched group in the regexp, is replaced by that
  /// string.
  ///
  /// Or a it can be a function, which will be called with the match
  /// array produced by
  /// [`RegExp.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec),
  /// as well as the start and end of the matched range, and which can
  /// return a [transaction](#state.Transaction) that describes the
  /// rule's effect, or null to indicate the input was not handled.
  constructor(
    /// @internal
    readonly regex: RegExp,
    handler:
      | string
      | ((
        tr: Transaction,
        state: EditorState,
        match: RegExpMatchArray,
        start: number,
        end: number,
      ) => Transaction | null),
    options: {
      /// When set to false,
      /// [`undoInputRule`](#inputrules.undoInputRule) doesn't work on
      /// this rule.
      undoable?: boolean;
      /// By default, input rules will not apply inside nodes marked
      /// as [code](#model.NodeSpec.code). Set this to true to change
      /// that, or to `"only"` to _only_ match in such nodes.
      inCode?: boolean | 'only';
    } = {},
  ) {
    this.regex = regex;
    this.handler = typeof handler == 'string'
      ? stringHandler(handler)
      : handler;
    this.undoable = options.undoable !== false;
    this.inCode = options.inCode || false;
  }
}

function stringHandler(string: string) {
  return function (
    tr: Transaction,
    state: EditorState,
    match: RegExpMatchArray,
    start: number,
    end: number,
  ) {
    if (!tr) {
      tr = state.tr;
    }

    let insert = string;
    if (match[1]) {
      const offset = match[0].lastIndexOf(match[1]);
      insert += match[0].slice(offset + match[1].length);
      start += offset;
      const cutOff = start - end;
      if (cutOff > 0) {
        insert = match[0].slice(offset - cutOff, offset) + insert;
        start = end;
      }
    }
    return tr.insertText(insert, start, end);
  };
}

/// Create an input rules plugin. When enabled, it will cause text
/// input that matches any of the given rules to trigger the rule's
/// action.
export class InputRulesPlugin extends Plugin<PluginState> {
  constructor(rules: readonly InputRule[]) {
    super({
      key: new PluginKey('input-rules'),
      state: {
        init() {
          return null;
        },
        apply(this: InputRulesPlugin, tr, prev) {
          const stored = tr.getMeta(this);
          if (stored) {
            return stored;
          }
          return tr.selectionSet || tr.docChanged ? null : prev;
        },
      },

      props: {
        handleTextInput(view, from, to, text) {
          const cmd = runInputRulesRange(from, to, text);
          const dispatch = (tr: Transaction) => {
            view.dispatch(tr);
          };
          return cmd(view.state, dispatch, view);
          // return run(view, from, to, text, rules, this);
        },
        handleDOMEvents: {
          compositionend: (view) => {
            setTimeout(() => {
              const { $cursor } = view.state.selection as TextSelection;
              if ($cursor) {
                const cmd = runInputRulesRange($cursor.pos, $cursor.pos, '');
                const dispatch = (tr: Transaction) => {
                  view.dispatch(tr);
                };
                return cmd(view.state, dispatch, view);
                // run(view, $cursor.pos, $cursor.pos, '', this);
              }
            });
          },
        },
      },

      rules,
      isInputRules: true,
    });
  }
}

export const runInputRulesTexts: CommandFactory = () => {
  const cmd: Command = (
    state: EditorState,
    dispatch?: (tr: Transaction) => void,
    view?: EditorView,
  ) => {
    const plugins = state.plugins;
    const plugin: InputRulesPlugin | undefined = plugins.find((plugin) =>
      (plugin.spec as any).isInputRules
    );
    if (!plugin) {
      return false;
    }

    const rules: readonly InputRule[] = plugin.spec.rules;

    if (view?.composing) return false;

    let doc = state.doc;
    let tr = state.tr;

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      const textNodePositions: { pos: number; node: ProseMirrorNode }[] = [];
      doc.descendants((node, pos) => {
        if (node.isText) {
          textNodePositions.push({ pos, node });
        }
      });

      if (textNodePositions.length === 0) {
        return false; // Nothing to do
      }

      // Process from the end of the document to the start to avoid position invalidation
      for (let i = textNodePositions.length - 1; i >= 0; i--) {
        const { pos, node } = textNodePositions[i];
        if (!node.isText || !node.text) continue;

        let text = node.text;

        if (node.type.spec.code) {
          if (!rule.inCode) continue;
        } else if (rule.inCode === 'only') {
          continue;
        }
        const match = rule.regex.exec(text);
        if (!match) {
          continue;
        }

        const index = match.index;

        const from = pos + index;
        const to = pos + index + match[0].length;

        let subTr = rule.handler(
          tr,
          state,
          match,
          from,
          to,
        );
        if (!subTr) continue;

        tr = subTr;
        doc = tr.doc;

        if (rule.undoable) {
          tr.setMeta(plugin, { transform: tr, from, to, text });
        }
      }
    }

    if (dispatch) {
      dispatch(tr);
    }

    return tr.docChanged;
  };

  cmd.displayName = 'runInputRulesTexts';

  return cmd;
};

export const runInputRulesRange: CommandFactory = (
  from: number,
  to: number,
  text: string,
) => {
  const cmd: Command = (
    state: EditorState,
    dispatch?: (tr: Transaction) => void,
    view?: EditorView,
  ) => {
    const plugins = state.plugins;
    const plugin: InputRulesPlugin | undefined = plugins.find((plugin) =>
      (plugin.spec as any).isInputRules
    );
    if (!plugin) {
      return false;
    }

    const rules: readonly InputRule[] = plugin.spec.rules;

    if (view?.composing) return false;

    const $from = state.doc.resolve(from);
    const textBefore = $from.parent.textBetween(
      Math.max(0, $from.parentOffset - MAX_MATCH),
      $from.parentOffset,
      null,
      '\ufffc',
    ) + text;
    let tr = state.tr;

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if ($from.parent.type.spec.code) {
        if (!rule.inCode) continue;
      } else if (rule.inCode === 'only') {
        continue;
      }
      const match = rule.regex.exec(textBefore);
      if (!match) {
        continue;
      }

      const subTr = rule.handler(
        tr,
        state,
        match,
        tr.mapping.map(from - (match[0].length - text.length)),
        tr.mapping.map(to),
      );
      if (!subTr) continue;

      tr = subTr;
      if (rule.undoable) {
        tr.setMeta(plugin, { transform: tr, from, to, text });
      }
      break;
    }

    if (tr.docChanged) {
      dispatch?.(tr);
      return true;
    }

    return false;
  };
  cmd.displayName = 'runInputRulesRange';

  return cmd;
};

/// This is a command that will undo an input rule, if applying such a
/// rule was the last thing that the user did.
export const undoInputRuleCommand: Command = (state, dispatch) => {
  const plugins = state.plugins;
  const plugin: InputRulesPlugin | undefined = plugins.find((plugin) =>
    (plugin.spec as any).isInputRules
  );
  if (!plugin) {
    return false;
  }

  const undoable: PluginState | undefined = plugin.getState(state);
  if (!undoable) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;
    const toUndo = undoable.transform;
    for (let j = toUndo.steps.length - 1; j >= 0; j--) {
      tr.step(toUndo.steps[j].invert(toUndo.docs[j]));
    }
    if (undoable.text) {
      const marks = tr.doc.resolve(undoable.from).marks();
      tr.replaceWith(
        undoable.from,
        undoable.to,
        state.schema.text(undoable.text, marks),
      );
    } else {
      tr.delete(undoable.from, undoable.to);
    }
    dispatch(tr);
  }
  return true;
};
