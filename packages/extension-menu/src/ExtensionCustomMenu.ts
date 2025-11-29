import { Plugin } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';
import { type MenuElement } from './menu.ts';
import { buildMenu } from './buildMenu.ts';
import { CustomMenuPlugin } from './CustomMenuPlugin.ts';
import { CollaborationStatusElement } from '@kerebron/extension-yjs/CollaborationStatus';
import { LspStatusElement } from '@kerebron/extension-lsp/LspStatus';

export interface CustomMenuOptions {
  /// Provides the content of the menu (pinnable tools)
  content?: readonly (readonly MenuElement[])[];
  /// Additional menu elements that always appear at the end of the toolbar (right side)
  /// These are not pinnable and will always be visible
  trailingElements?: readonly MenuElement[];
  /// Whether to automatically add the collaboration status element when YJS is detected
  /// Defaults to true
  autoAddCollaborationStatus?: boolean;
  /// Whether to automatically add the LSP status element when LSP is detected
  /// Defaults to true
  autoAddLspStatus?: boolean;
}

/// Extension for a customizable menu with pinned items
export class ExtensionCustomMenu extends Extension<CustomMenuOptions> {
  name = 'customMenu';

  override getProseMirrorPlugins(): Plugin[] {
    const content = this.config?.content ??
      buildMenu(this.editor, this.editor.schema);
    const trailingElements: MenuElement[] = this.config?.trailingElements
      ? [...this.config.trailingElements]
      : [];

    // Auto-add collaboration status if YJS extension is present
    const autoAdd = this.config?.autoAddCollaborationStatus ?? true;
    if (autoAdd) {
      const yjsExtension = this.editor.getExtension('yjs');
      if (yjsExtension) {
        const yjsConfig = (yjsExtension as any).config;
        if (yjsConfig?.provider?.awareness) {
          const collabStatus = new CollaborationStatusElement({
            awareness: yjsConfig.provider.awareness,
            provider: yjsConfig.provider,
          });
          trailingElements.push(collabStatus);
        }
      }
    }

    // Auto-add LSP status if LSP extension is present
    const autoAddLsp = this.config?.autoAddLspStatus ?? true;
    if (autoAddLsp) {
      const lspExtension = this.editor.getExtension('lsp');
      if (lspExtension) {
        const lspStatus = new LspStatusElement({
          lspExtension: lspExtension as any,
          label: 'LSP',
        });
        trailingElements.push(lspStatus);
      }
    }

    return [
      new CustomMenuPlugin(this.editor, {
        content,
        trailingElements,
      }),
    ];
  }
}
