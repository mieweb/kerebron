import { KerebronPopup } from '../popup/types.ts';

export function bindSelect(
  popup: KerebronPopup,
  cbk: (value: string, idx: number) => void,
) {
  popup.addEventListener('click', (event) => {
    if (!event.target) {
      return;
    }
    const select = (event.target as HTMLSelectElement).closest('select');
    if (select) {
      event.preventDefault();
      event.stopPropagation();
      cbk(select.value, select.selectedIndex);
    }
  }, true);

  popup.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      if (!event.target) {
        return;
      }
      const select = (event.target as HTMLSelectElement).closest('select');
      if (select) {
        event.preventDefault();
        event.stopPropagation();
        cbk(select.value, select.selectedIndex);
      }
    }
  }, true);
}
