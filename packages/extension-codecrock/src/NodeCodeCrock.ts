import { EditorView, NodeViewConstructor } from 'prosemirror-view';
import {
  EditorState,
  Selection,
  TextSelection,
  Transaction,
} from 'prosemirror-state';
import type { Node as PMNode, NodeType, ResolvedPos } from 'prosemirror-model';

import { type CoreEditor } from '@kerebron/editor';
import { getShadowRoot } from '@kerebron/editor/utilities';
import {
  Command,
  type CommandFactories,
  type CommandShortcuts,
} from '@kerebron/editor/commands';

import { getLangsList } from '@kerebron/wasm';
import { NodeCodeBlock } from '@kerebron/extension-basic-editor/NodeCodeBlock';

import { NodeViewCodeCrock } from './NodeViewCodeCrock.ts';

declare module '@kerebron/editor/commands' {
  interface Commands<ReturnType = any> {
    /**
     * Turn the current block into a code block.
     *
     * @param lang Language for syntax highlighting.
     */
    setCodeBlock: (lang?: string) => ReturnType;
    /**
     * Insert an empty paragraph at `at` and place the caret inside it.
     *
     * @param at Document position to insert the paragraph at.
     */
    insertEmptyParagraph: (at: number) => ReturnType;
    /** Move the selection left into an adjacent code block. */
    ArrowLeft: () => ReturnType;
    /** Move the selection right into an adjacent code block. */
    ArrowRight: () => ReturnType;
    /** Move the selection up into an adjacent code block. */
    ArrowUp: () => ReturnType;
    /** Move the selection down into an adjacent code block. */
    ArrowDown: () => ReturnType;
  }
}

function arrowHandler(dir: 'left' | 'right' | 'up' | 'down'): Command {
  return function (
    state: EditorState,
    dispatch?: (tr: Transaction) => void,
    view?: EditorView,
  ) {
    if (!view) {
      return false;
    }
    if (state.selection.empty && view.endOfTextblock(dir)) {
      let side = dir == 'left' || dir == 'up' ? -1 : 1;
      let $head = state.selection.$head;
      let nextPos = Selection.near(
        state.doc.resolve(side > 0 ? $head.after() : $head.before()),
        side,
      );
      if (nextPos.$head && nextPos.$head.parent.type.name == 'code_block') {
        if (dispatch) {
          dispatch(state.tr.setSelection(nextPos));
        }
        return true;
      }
    }
    return false;
  };
}

/**
 * Offset of `$pos` within the text that `blocks` contribute to a merged
 * code block (block texts are joined by newlines), or undefined when
 * `$pos` is not inside one of the blocks. `toCode` must match the
 * leaf-to-text mapping used to build the code block's text.
 */
function codeTextOffset(
  blocks: Array<{ pos: number; node: PMNode }>,
  $pos: ResolvedPos,
  toCode: (() => string) | undefined,
): number | undefined {
  const index = blocks.findIndex(({ pos, node }) =>
    pos < $pos.pos && $pos.pos < pos + node.nodeSize
  );
  if (index < 0) return undefined;
  let offset = index; // one newline per join with a preceding block
  for (let i = 0; i < index; i++) {
    const { node } = blocks[i];
    offset += node.textBetween(0, node.content.size, '', toCode).length;
  }
  const { pos, node } = blocks[index];
  offset += node.textBetween(0, $pos.pos - pos - 1, '', toCode).length;
  return offset;
}

export interface NodeCodeCrockConfig {
  readOnly?: boolean;
  languageWhitelist?: string[];
}

export class NodeCodeCrock extends NodeCodeBlock {
  constructor(override config: NodeCodeCrockConfig) {
    super(config);
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'setCodeBlock': (lang?: string) => {
        return function (state, dispatch, view) {
          const { schema } = state;

          // Process every selection range separately: a CellSelection
          // only reports its head cell via from/to, while the other
          // selected cells are additional ranges. Blocks within one
          // range are merged into a single code block.
          const groups: Array<Array<{ pos: number; node: PMNode }>> = [];
          for (const { $from, $to } of state.selection.ranges) {
            const blocks: Array<{ pos: number; node: PMNode }> = [];
            state.doc.nodesBetween(
              $from.pos,
              $to.pos,
              (node, pos) => {
                if (node.isTextblock) blocks.push({ pos, node });
                return !node.isTextblock;
              },
            );
            if (blocks.length > 0) groups.push(blocks);
          }
          if (groups.length === 0) return false;
          if (!dispatch) return true;

          // Apply back-to-front so positions of pending groups stay valid.
          groups.sort((a, b) => b[0].pos - a[0].pos);

          const textSelection = state.selection instanceof TextSelection
            ? state.selection
            : undefined;
          let tr = state.tr;
          for (const blocks of groups) {
            // textContent drops inline hard-break leaf nodes, so map
            // the schema's linebreakReplacement node to a newline instead.
            const toCode = schema.linebreakReplacement ? () => '\n' : undefined;
            const text = blocks.map(({ node }) =>
              node.textBetween(0, node.content.size, '', toCode)
            ).join('\n');
            const codeBlock = type.create(
              { lang, id: crypto.randomUUID() },
              text ? schema.text(text) : null,
            );
            const first = blocks[0];
            const last = blocks[blocks.length - 1];
            tr = tr.replaceWith(
              first.pos,
              last.pos + last.node.nodeSize,
              codeBlock,
            );
            if (textSelection) {
              const head = codeTextOffset(blocks, textSelection.$head, toCode);
              const anchor = codeTextOffset(
                blocks,
                textSelection.$anchor,
                toCode,
              );
              if (head !== undefined && anchor !== undefined) {
                tr = tr.setSelection(TextSelection.create(
                  tr.doc,
                  first.pos + 1 + anchor,
                  first.pos + 1 + head,
                ));
              }
            }
          }
          dispatch(tr.scrollIntoView());
          return true;
        };
      },
      'insertEmptyParagraph': (at: number) => {
        return function (state, dispatch, view) {
          const { paragraph } = state.schema.nodes;
          if (!paragraph || at < 0 || at > state.doc.content.size) return false;

          let tr = state.tr.insert(at, paragraph.create());
          tr = tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)));

          if (dispatch) {
            dispatch(tr);
            view?.focus();
          }
          return true;
        };
      },
      ArrowLeft: () => arrowHandler('left'),
      ArrowRight: () => arrowHandler('right'),
      ArrowUp: () => arrowHandler('up'),
      ArrowDown: () => arrowHandler('down'),
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Shift-Ctrl-"': 'setCodeBlock',
      'ArrowLeft': 'ArrowLeft',
      'ArrowRight': 'ArrowRight',
      'ArrowUp': 'ArrowUp',
      'ArrowDown': 'ArrowDown',
    };
  }

  override getNodeView(editor: CoreEditor): NodeViewConstructor {
    return (...args) => {
      const node = args[0];

      const shadowRoot = getShadowRoot(this.editor.config.element);
      const settings = {
        languageWhitelist: this.config.languageWhitelist || getLangsList(),
        shadowRoot,
        readOnly: this.editor.config.readOnly || this.config.readOnly,
        undo: () => {
          this.editor.chain().undo().run();
        },
        redo: () => {
          this.editor.chain().redo().run();
        },
      };

      const nodeView = new NodeViewCodeCrock(editor, settings, ...args);
      nodeView.init();
      return nodeView;
    };
  }
}
