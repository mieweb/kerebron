import type { NodeSpec, NodeType } from 'prosemirror-model';
import { Node as PmNode } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';

import {
  type CoreEditor,
  NESTING_CLOSING,
  NESTING_OPENING,
  Node,
} from '@kerebron/editor';
import { type CommandFactories } from '@kerebron/editor/commands';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { CommandFactory } from '@kerebron/editor/commands';

function collectCommentAnchors(doc: PmNode) {
  const starts = new Map();
  const ends = new Map();

  doc.descendants((node, pos) => {
    if (node.type.name === 'comment') {
      if (node.attrs.nesting === NESTING_OPENING) {
        starts.set(node.attrs.id, pos);
      }
      if (node.attrs.nesting === NESTING_CLOSING) {
        ends.set(node.attrs.id, pos);
      }
    }
  });

  return { starts, ends };
}

function buildCommentRanges(doc: PmNode) {
  const { starts, ends } = collectCommentAnchors(doc);
  const ranges = [];

  for (const [id, from] of starts) {
    const to = ends.get(id);
    if (!to || to <= from) continue;

    ranges.push({
      id,
      from: from + 1, // skip start atom
      to, // end atom position
    });
  }

  return ranges;
}

function buildDecorations(doc: PmNode) {
  const ranges = buildCommentRanges(doc);

  return DecorationSet.create(
    doc,
    ranges.map(({ id, from, to }) =>
      Decoration.inline(from, to, {
        class: 'comment-highlight',
        'data-comment-id': id,
      })
    ),
  );
}

function commentsPlugin(): Plugin {
  return new Plugin({
    state: {
      init(_, { doc }) {
        return buildDecorations(doc);
      },
      apply(tr, oldDecos, oldState, newState) {
        if (!tr.docChanged) return oldDecos;
        return buildDecorations(newState.doc);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

const addCommentBoundary: CommandFactory = (id) => {
  return (state, dispatch) => {
    const { schema, selection } = state;
    const { from, to } = selection;

    const commentType = schema.nodes.comment;
    if (!commentType) return false;

    const startNode = commentType.create({ id, nesting: NESTING_OPENING });
    const endNode = commentType.create({ id, nesting: NESTING_CLOSING });

    const tr = state.tr;

    tr.insert(to, endNode);
    tr.insert(from, startNode);

    // Optional: restore selection
    // tr = tr.setSelection(
    //   TextSelection.create(tr.doc, from, to + startNode.nodeSize)
    // );

    if (dispatch) dispatch(tr);
    return true;
  };
};

export class NodeCommentAnchor extends Node {
  override name = 'comment';
  requires = ['doc'];

  options = {
    keepMarks: true,
  };

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      group: 'inline',
      selectable: false,
      atom: true,
      attrs: {
        id: {},
        active: {
          default: false,
        },
        nesting: {
          default: NESTING_OPENING,
        },
      },
      parseDOM: [
        {
          tag: 'span[data-comment-id]',
          getAttrs(dom: HTMLElement) {
            return {
              id: dom.getAttribute('data-comment-id'),
              nesting: parseInt(dom.getAttribute('data-nesting') || '1'),
              active: dom.hasAttribute('data-active'),
            };
          },
        },
      ],
      toDOM: (
        node,
      ) => ['span', {
        'data-comment-id': node.attrs.id,
        'data-active': node.attrs.active ? 'true' : undefined,
        'data-nesting': node.attrs.nesting,
      }],
    };
  }

  override getCommandFactories(
    editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      'addComment': (id, active) => addCommentBoundary(id, active),
    };
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      commentsPlugin(),
      // dropCursor(this.options),
    ];
  }
}
