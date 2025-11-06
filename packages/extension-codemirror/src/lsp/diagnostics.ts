import { ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { LSPPlugin } from './plugin.ts';
import type { LSPClientExtension } from './LSPExtension.ts';

export const autoSync = ViewPlugin.fromClass(
  class {
    pending = -1;
    update(update: ViewUpdate) {
      if (update.docChanged) {
        if (this.pending > -1) clearTimeout(this.pending);
        this.pending = setTimeout(() => {
          this.pending = -1;
          let plugin = LSPPlugin.get(update.view);
          if (plugin) plugin.client.sync();
        }, 500);
      }
    }
    destroy() {
      if (this.pending > -1) clearTimeout(this.pending);
    }
  },
);

export function serverDiagnostics(): LSPClientExtension {
  return {
    editorExtension: autoSync,
  };
}
