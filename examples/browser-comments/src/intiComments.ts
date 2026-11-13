import { CoreEditor } from '@kerebron/editor';
import { toDOMElement } from '@kerebron/ui/utilities/toDOMElement';
import { HoverMatch, HoverSource, HoverTrigger } from '@kerebron/ui/hover';
import { KerebronPopup } from '@kerebron/ui/popup';
import { Ui } from '@kerebron/ui';

interface Comment {
  id: string;
  msg: string;
}

const comments: Array<Comment> = [];
let activeComment = '';

export function initComments(editor: CoreEditor) {
  function renderComments() {
    document.getElementById('comments')!
      .replaceChildren(
        ...comments.map((c) =>
          toDOMElement(
            activeComment === c.id ? ['li', ['strong', c.msg]] : ['li', c.msg],
          )
        ),
      );
  }

  function addComment() {
    const msg = globalThis.prompt('Comment message').trim();
    if (!msg) {
      return;
    }
    const id: string = crypto.randomUUID();

    editor.chain().addComment(id).run();

    comments.push({
      id,
      msg,
    });

    renderComments();
  }
  document.getElementById('addComment')!.addEventListener(
    'click',
    () => addComment(),
  );

  const ui: Ui = editor.ci.resolve('ui');

  const hoverSource: HoverSource = {
    match: function (trigger: HoverTrigger): HoverMatch | undefined {
      if (trigger.mode !== 'mouse') {
        return;
      }

      const commentId = trigger.dataset?.commentId;
      if (!commentId) {
        return;
      }

      const pos = trigger.pos;

      const comment = comments.find((c) => c.id === commentId);
      if (!comment) {
        return;
      }

      return {
        range: {
          from: pos,
          to: pos,
        },
        text: '',
        meta: comment,
      };
    },
    processRequest: async function (
      trigger,
      match,
      createPopup: () => KerebronPopup,
    ) {
      if (!match.meta) {
        return;
      }

      const popup = createPopup();
      ui.setPopupContent(popup, ['markdown', match.meta.msg]);
      activeComment = match.meta.id;
      popup.addEventListener('remove', () => {
        activeComment = '';
        renderComments();
      });

      renderComments();

      return { ...match };
    },
  };
  editor.chain().addHoverSource(hoverSource).run();
}
