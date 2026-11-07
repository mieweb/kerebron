import { CoreEditor } from '@kerebron/editor';

import {
  ContentMapper,
  Workspace,
  WorkspaceModifyParams,
} from '@kerebron/workspace';

export function attachMarkdownPreview(editor: CoreEditor) {
  let snapshot: {
    version: number;
    getContentMapper: () => Promise<ContentMapper>;
  } | undefined;

  const workspace: Workspace = editor.ci.resolve('workspace')!;
  workspace.addEventListener(
    'modifyFile',
    (event: CustomEvent<WorkspaceModifyParams>) => {
      if (
        event.detail.uri !== editor.config.uri ||
        event.detail.version !== editor.version
      ) {
        return;
      }
      snapshot = {
        version: event.detail.version,
        getContentMapper: event.detail.getContentMapper,
      };
    },
  );

  editor.addEventListener('selection', async (event: CustomEvent) => {
    const selection = event.detail.selection;
    if (snapshot) {
      const contentMapper: ContentMapper = await snapshot.getContentMapper();

      const md = contentMapper.getTextContent();
      const from = contentMapper.toRawTextPos(selection.from);
      const to = contentMapper.toRawTextPos(selection.to);

      const markdownElement = document.getElementById('markdown');
      if (markdownElement) {
        markdownElement.replaceChildren();
        if (from > -1 && to > -1) {
          const parts = [
            md.substring(0, from),
            md.substring(from, to),
            md.substring(to),
          ];
          for (const [index, text] of parts.entries()) {
            const span = document.createElement('span');
            if (index === 1) span.className = 'md-selected';
            span.textContent = text;
            markdownElement.appendChild(span);
          }
        } else {
          markdownElement.textContent = md;
        }
      }
    }
  });
}
