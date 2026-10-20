export function bindLinks(popup: KerebronPopup) {
  popup.addEventListener('click', (event) => {
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
      );
    }
  }, true);

  popup.addEventListener('keydown', (event) => {
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
        );
      }
    }
  }, true);
}
