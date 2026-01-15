import { Command } from 'prosemirror-state';

// Related tests:
// test ./header-link.md
// test ./project-overview.md
// test ./list-indent.md
// test ./strong-headers.md
export const fixIdLinks: Command = (state, dispatch): boolean => {
  let tr = state.tr;

  const markType = state.schema.marks.link;

  state.doc.descendants((node, pos) => {
    node.marks.forEach((mark) => {
      if (mark.type === markType && mark.attrs.href.startsWith('#')) {
        const innerTxt = node.text || node.textBetween(0, node.content.size);
        const escapedText = innerTxt.toLowerCase().replace(/[^\w]+/g, ' ')
          .trim().replaceAll(' ', '-');

        if (escapedText) {
          tr = tr
            .removeMark(pos, pos + node.nodeSize, markType)
            .addMark(
              pos,
              pos + node.nodeSize,
              markType.create({ ...mark.attrs, href: '#' + escapedText }),
            );
        }
      }
    });
  });

  if (dispatch) {
    dispatch(tr);
  }

  return tr.docChanged;
};
