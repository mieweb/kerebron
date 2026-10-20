import { KerebronPopup } from '../popup/types.ts';

export function bindLinks(popup: KerebronPopup) {
  popup.addEventListener('click', (event: MouseEvent) => {
    if (!event.target) {
      return;
    }
    const link = (event.target as HTMLElement).closest('a');
    if (link) {
      event.preventDefault();
      event.stopPropagation();
      popup.ownerDocument.defaultView?.open(
        link.href,
        '_blank',
        'noopener',
      );
    }
  }, true);

  popup.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (!event.target) {
        return;
      }
      const link = (event.target as HTMLElement).closest('a');
      if (link) {
        event.preventDefault();
        event.stopPropagation();
        popup.ownerDocument.defaultView?.open(
          link.href,
          '_blank',
          'noopener',
        );
      }
    }
  }, true);
}
