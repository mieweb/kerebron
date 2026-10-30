import { CoreEditor } from '@kerebron/editor';
import { SearchQuery, SearchState } from '@kerebron/editor/search';

import { KerebronPopup } from '../popup/types.ts';

export function bindSearch(popup: KerebronPopup, editor: CoreEditor) {
  popup.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();

    let searchState: SearchState | undefined;
    editor.run.getSearchState((value: SearchState) => {
      searchState = value;
    });
    if (!searchState) {
      throw new Error('Impossible');
    }

    const form = event.target as HTMLFormElement;
    const attrs = Object.fromEntries(
      new FormData(form).entries().map((e) => [e[0], e[1].toString()]),
    );

    if (
      searchState.query.search !== form.search ||
      searchState.query.replace !== form.replace
    ) {
      editor.run.search(
        new SearchQuery({
          search: attrs.search || '',
          replace: attrs.replace || '',
        }),
      );
    }

    switch (event.submitter?.getAttribute('name')) {
      case 'prev':
        editor.run.findPrev();
        break;
      case 'next':
        editor.run.findNext();
        break;
      case 'replace_next':
        editor.run.replaceNext();
        break;
      case 'replace_all':
        editor.run.replaceAll();
        break;
    }
  });
}

export function bindReplace(popup: KerebronPopup, editor: CoreEditor) {
  return bindSearch(popup, editor);
}
