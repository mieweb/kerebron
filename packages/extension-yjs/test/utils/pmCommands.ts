import { CommandFactory } from '@kerebron/editor/commands';

export const prependNewParagraph: CommandFactory = (
  txt: string,
  metas?: Record<string, any>,
) => {
  return (state, dispatch) => {
    const tr = state.tr;

    const schema = state.schema;

    const text = schema.text(txt);
    const para = schema.nodes.paragraph.create(null, text);
    tr.insert(tr.mapping.map(0), para);

    if (metas) {
      for (const [key, val] of Object.entries(metas)) {
        tr.setMeta(key, val);
      }
    }

    if (dispatch) {
      dispatch(tr);
    }

    return tr.docChanged;
  };
};

export const appendNewParagraph: CommandFactory = (txt: string) => {
  return (state, dispatch) => {
    const tr = state.tr;

    const schema = state.schema;
    const doc = state.doc;

    const text = schema.text(txt);
    const para = schema.nodes.paragraph.create(null, text);
    tr.insert(tr.mapping.map(doc.content.size), para);

    if (dispatch) {
      dispatch(tr);
    }

    return tr.docChanged;
  };
};

export const appendTextToFirstNode: CommandFactory =
  (text: string) => (state, dispatch) => {
    const { doc, tr } = state;

    const first = doc.firstChild;
    if (!first) return false;

    const pos = 1 + first.content.size;

    if (dispatch) {
      dispatch(
        tr.insertText(text, pos),
      );
    }

    return true;
  };
