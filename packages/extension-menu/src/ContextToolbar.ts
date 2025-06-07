import { EditorView } from 'prosemirror-view';
import { EditorState, Plugin, PluginKey } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';

import { type CoreEditor } from '@kerebron/editor';
import { MenuItem, MenuElement } from './menu.ts';

const contextToolbarKey = new PluginKey('contextToolbar');

export interface ContextToolbarConfig {
  /// Whether to show the context toolbar on text selection
  showOnSelection?: boolean;
  /// Custom menu items to show in the context toolbar
  items?: MenuElement[];
  /// Custom positioning function
  position?: (view: EditorView, dom: HTMLElement) => { top: number; left: number };
}

export class ContextToolbarPlugin extends Plugin {
  constructor(
    private editor: CoreEditor,
    private schema: Schema,
    config: ContextToolbarConfig = {}
  ) {
    super({
      key: contextToolbarKey,
      state: {
        init() {
          return { show: false, selection: null };
        },
        apply(tr, prev) {
          const selection = tr.selection;
          const show = !selection.empty && config.showOnSelection !== false;
          
          if (show !== prev.show || !selection.eq(prev.selection)) {
            return { show, selection };
          }
          return prev;
        },
      },
      view: (view) => new ContextToolbarView(view, this.editor, this.schema, config),
    });
  }
}

class ContextToolbarView {
  dom: HTMLElement;
  private isVisible = false;

  constructor(
    private view: EditorView,
    private editor: CoreEditor,
    private schema: Schema,
    private config: ContextToolbarConfig
  ) {
    this.dom = document.createElement('div');
    this.dom.className = 'kb-format-popup';
    this.dom.setAttribute('role', 'toolbar');
    this.dom.setAttribute('aria-label', 'Text formatting');

    // Create default menu items if none provided
    const items = this.config.items || this.createDefaultItems();
    
    items.forEach(item => {
      const rendered = item.render(view);
      this.dom.appendChild(rendered.dom);
    });

    // Hide initially
    this.dom.style.display = 'none';
    
    // Append to editor container
    const editorContainer = view.dom.closest('.kb-editor') || view.dom.parentElement;
    if (editorContainer) {
      editorContainer.appendChild(this.dom);
    }

    this.update(view, null);
  }

  update(view: EditorView, lastState: EditorState | null) {
    const state = contextToolbarKey.getState(view.state);
    
    if (state.show && !view.state.selection.empty) {
      this.show();
      this.position();
    } else {
      this.hide();
    }
  }

  private show() {
    if (!this.isVisible) {
      this.isVisible = true;
      this.dom.style.display = 'flex';
      this.dom.classList.add('kb-format-popup--visible');
    }
  }

  private hide() {
    if (this.isVisible) {
      this.isVisible = false;
      this.dom.classList.remove('kb-format-popup--visible');
      // Use setTimeout to allow animation to complete
      setTimeout(() => {
        if (!this.isVisible) {
          this.dom.style.display = 'none';
        }
      }, 200);
    }
  }

  private position() {
    if (this.config.position) {
      const pos = this.config.position(this.view, this.dom);
      this.dom.style.top = pos.top + 'px';
      this.dom.style.left = pos.left + 'px';
      return;
    }

    // Default positioning logic
    const selection = this.view.state.selection;
    const coords = this.view.coordsAtPos(selection.from);
    const editorRect = this.view.dom.getBoundingClientRect();
    const toolbarRect = this.dom.getBoundingClientRect();
    
    // Position above selection on mobile, to the side on desktop
    const isMobile = window.innerWidth < 768;
    
    let top: number;
    let left: number;
    
    if (isMobile) {
      // Position above selection with some margin
      top = coords.top - toolbarRect.height - 8;
      left = Math.max(8, Math.min(
        editorRect.width - toolbarRect.width - 8,
        coords.left - toolbarRect.width / 2
      ));
    } else {
      // Position to the right of selection
      top = coords.top - toolbarRect.height / 2;
      left = Math.min(
        editorRect.width - toolbarRect.width - 8,
        coords.right + 8
      );
    }
    
    // Ensure toolbar stays within viewport
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    if (top < 8) top = coords.bottom + 8;
    if (left < 8) left = 8;
    if (left + toolbarRect.width > viewportWidth - 8) {
      left = viewportWidth - toolbarRect.width - 8;
    }
    if (top + toolbarRect.height > viewportHeight - 8) {
      top = viewportHeight - toolbarRect.height - 8;
    }

    this.dom.style.position = 'absolute';
    this.dom.style.top = top + 'px';
    this.dom.style.left = left + 'px';
  }

  private createDefaultItems(): MenuElement[] {
    const items: MenuElement[] = [];

    // Add basic formatting options
    if (this.schema.marks.strong) {
      items.push(new MenuItem({
        title: 'Bold',
        icon: { text: 'B', css: 'font-weight: bold' },
        run: () => this.editor.chain().toggleStrong().run(),
        active: (state) => {
          const { from, to } = state.selection;
          return state.doc.rangeHasMark(from, to, this.schema.marks.strong);
        },
      }));
    }

    if (this.schema.marks.em) {
      items.push(new MenuItem({
        title: 'Italic',
        icon: { text: 'I', css: 'font-style: italic' },
        run: () => this.editor.chain().toggleItalic().run(),
        active: (state) => {
          const { from, to } = state.selection;
          return state.doc.rangeHasMark(from, to, this.schema.marks.em);
        },
      }));
    }

    if (this.schema.marks.underline) {
      items.push(new MenuItem({
        title: 'Underline',
        icon: { text: 'U', css: 'text-decoration: underline' },
        run: () => this.editor.chain().toggleUnderline().run(),
        active: (state) => {
          const { from, to } = state.selection;
          return state.doc.rangeHasMark(from, to, this.schema.marks.underline);
        },
      }));
    }

    if (this.schema.marks.code) {
      items.push(new MenuItem({
        title: 'Code',
        icon: { text: '</>', css: 'font-family: monospace; font-size: 0.8em' },
        run: () => this.editor.chain().toggleCode().run(),
        active: (state) => {
          const { from, to } = state.selection;
          return state.doc.rangeHasMark(from, to, this.schema.marks.code);
        },
      }));
    }

    return items;
  }

  destroy() {
    if (this.dom.parentNode) {
      this.dom.parentNode.removeChild(this.dom);
    }
  }
}

export function createContextToolbar(
  editor: CoreEditor,
  schema: Schema,
  config: ContextToolbarConfig = {}
): Plugin {
  return new ContextToolbarPlugin(editor, schema, config);
}