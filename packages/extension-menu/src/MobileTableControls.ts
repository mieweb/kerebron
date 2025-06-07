import { EditorView } from 'prosemirror-view';
import { Plugin, PluginKey } from 'prosemirror-state';

import { type CoreEditor } from '@kerebron/editor';

// Helper function to find parent node
function findParentNode(predicate: (node: any) => boolean) {
  return (selection: any) => {
    const { $from } = selection;
    for (let i = $from.depth; i > 0; i--) {
      const node = $from.node(i);
      if (predicate(node)) {
        return {
          node,
          pos: $from.before(i),
          start: $from.start(i),
          depth: i,
        };
      }
    }
    return null;
  };
}

const mobileTableControlsKey = new PluginKey('mobileTableControls');

export interface MobileTableControlsConfig {
  /// Whether to enable mobile table controls
  enabled?: boolean;
}

export class MobileTableControlsPlugin extends Plugin {
  constructor(
    private editor: CoreEditor,
    config: MobileTableControlsConfig = {}
  ) {
    super({
      key: mobileTableControlsKey,
      view: (view) => new MobileTableControlsView(view, editor, config),
    });
  }
}

class MobileTableControlsView {
  dom: HTMLElement | null = null;
  private currentTable: Element | null = null;

  constructor(
    private view: EditorView,
    private editor: CoreEditor,
    private config: MobileTableControlsConfig
  ) {
    this.update(view, null);
  }

  update(view: EditorView) {
    this.view = view;
    
    // Only show on mobile
    if (window.innerWidth >= 768 || this.config.enabled === false) {
      this.hide();
      return;
    }

    // Check if cursor is in a table
    const tableNode = findParentNode(node => node.type.name === 'table')(view.state.selection);
    
    if (tableNode) {
      this.showControls();
    } else {
      this.hide();
    }
  }

  private showControls() {
    if (this.dom) return; // Already showing

    this.dom = document.createElement('div');
    this.dom.className = 'kb-table-controls--mobile';
    this.dom.setAttribute('role', 'toolbar');
    this.dom.setAttribute('aria-label', 'Table controls');

    // Create table control buttons
    const buttons = [
      {
        label: 'Add Row',
        action: 'addRowBefore',
        icon: '⬆️',
      },
      {
        label: 'Add Column',
        action: 'addColumnBefore', 
        icon: '⬅️',
      },
      {
        label: 'Delete Row',
        action: 'deleteRow',
        icon: '🗑️',
        destructive: true,
      },
      {
        label: 'Delete Column',
        action: 'deleteColumn',
        icon: '🗑️',
        destructive: true,
      },
    ];

    buttons.forEach(buttonConfig => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${buttonConfig.icon} ${buttonConfig.label}`;
      button.setAttribute('aria-label', buttonConfig.label);
      
      if (buttonConfig.destructive) {
        button.style.color = 'var(--kb-color-error)';
      }

      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.executeTableAction(buttonConfig.action);
      });

      // Update button state based on editor capabilities
      const updateButton = () => {
        const canExecute = this.editor.can()[buttonConfig.action]?.().run();
        button.disabled = !canExecute;
      };

      updateButton();
      this.dom!.appendChild(button);
    });

    // Insert the controls after the table
    const tableElement = this.view.dom.querySelector('table');
    if (tableElement && tableElement.parentNode) {
      tableElement.parentNode.insertBefore(this.dom, tableElement.nextSibling);
    }
  }

  private hide() {
    if (this.dom && this.dom.parentNode) {
      this.dom.parentNode.removeChild(this.dom);
      this.dom = null;
    }
  }

  private executeTableAction(action: string) {
    try {
      const command = this.editor.chain()[action]();
      if (command.run) {
        command.run();
        this.view.focus();
      }
    } catch (error) {
      console.warn(`Failed to execute table action: ${action}`, error);
    }
  }

  destroy() {
    this.hide();
  }
}

export function createMobileTableControlsPlugin(
  editor: CoreEditor,
  config: MobileTableControlsConfig = {}
): Plugin {
  return new MobileTableControlsPlugin(editor, config);
}