import { CoreEditor } from '@kerebron/editor';
import { toDOMElement } from '@kerebron/ui/utilities/toDOMElement';

export function initSnapshots(editor: CoreEditor) {
  const snapshots: Array<Uint8Array> = [];
  let activeSnapshot = -1;

  function renderSnapshots() {
    document.getElementById('snapshots')!
      .replaceChildren(
        ...snapshots.map((s, idx) =>
          toDOMElement([
            'li',
            ['span', 'Snapshot ' + idx],
            (idx > 0 && (activeSnapshot === -1 || activeSnapshot !== idx))
              ? ['button', { 'data-snapshot': idx }, 'show']
              : [],
          ])
        ),
      );

    if (activeSnapshot > -1) {
      document.getElementById('addSnapshot')!.style.display = 'none';
      document.getElementById('resetYSnapshot')!.style.display = '';
    } else {
      document.getElementById('addSnapshot')!.style.display = '';
      document.getElementById('resetYSnapshot')!.style.display = 'none';
    }
  }

  document.getElementById('snapshots')!.addEventListener('click', (event) => {
    const item = event.target as HTMLDataListElement;
    if ('undefined' !== typeof item.dataset.snapshot) {
      const idx = parseInt(item.dataset.snapshot);
      if (idx < 1) {
        return;
      }
      const prevSnapshot = snapshots[idx - 1];
      const snapshot = snapshots[idx];

      activeSnapshot = idx;

      editor.chain().setYSnapshot({ snapshot, prevSnapshot }).run();
      renderSnapshots();
    }
  });

  async function addSnapshot() {
    const snapshot: Uint8Array = await new Promise((resolve, reject) =>
      editor.chain().getYSnapshot({ resolve, reject }).run()
    );

    snapshots.push(
      snapshot,
    );

    renderSnapshots();
  }
  document.getElementById('addSnapshot')!.addEventListener(
    'click',
    () => addSnapshot(),
  );
  document.getElementById('resetYSnapshot')!.addEventListener('click', () => {
    activeSnapshot = -1;
    renderSnapshots();
    editor.chain().resetYSnapshot().run();
  });
}
