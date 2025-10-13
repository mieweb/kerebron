import { EditorView } from 'prosemirror-view';
import { EditorState, Plugin } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';

import { type CoreEditor, Extension } from '@kerebron/editor';
import { MenuElement } from './menu.ts';
import { buildMenu } from './ExtensionMenu.ts';

const CSS_PREFIX = 'kb-custom-menu';
const MAX_PINNED_ITEMS = 8;
const STORAGE_KEY = 'kb-custom-menu-pinned';
// Bootstrap md breakpoint: 768px (mobile is < 768px, desktop is >= 768px)
const MOBILE_BREAKPOINT = 768;

interface ToolItem {
  id: string;
  label: string;
  element: MenuElement;
  isPinned: boolean;
  updateFn: (state: EditorState) => boolean;
}

class CustomMenuView {
  wrapper: HTMLElement;
  toolbar: HTMLElement;
  overflowMenu: HTMLElement;
  modal: HTMLElement | null = null;
  tools: ToolItem[] = [];
  root: Document | ShadowRoot;
  resizeHandle: HTMLElement;
  editorContainer: HTMLElement;
  private closeOverflowHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    readonly editorView: EditorView,
    readonly editor: CoreEditor,
    readonly content: readonly (readonly MenuElement[])[],
  ) {
    this.root = editorView.root;

    // Create wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add(CSS_PREFIX + '__wrapper');

    // Create toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.classList.add(CSS_PREFIX);
    this.toolbar.setAttribute('role', 'toolbar');

    // Create editor container with resize handle
    this.editorContainer = document.createElement('div');
    this.editorContainer.classList.add(CSS_PREFIX + '__editor-container');
    this.editorContainer.style.height = '50vh'; // Start at 50% height

    // Create resize handle
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.classList.add(CSS_PREFIX + '__resize-handle');
    this.resizeHandle.innerHTML = '<div class="' + CSS_PREFIX +
      '__resize-handle-bar"></div>';

    // Mount toolbar before the editor DOM
    this.wrapper.appendChild(this.toolbar);
    if (editorView.dom.parentNode) {
      editorView.dom.parentNode.replaceChild(this.wrapper, editorView.dom);
    }

    // Wrap editor in container and add resize handle
    this.editorContainer.appendChild(editorView.dom);
    this.editorContainer.appendChild(this.resizeHandle);
    this.wrapper.appendChild(this.editorContainer);

    // Create overflow menu (initially hidden)
    this.overflowMenu = document.createElement('div');
    this.overflowMenu.classList.add(CSS_PREFIX + '__overflow-menu');
    this.overflowMenu.style.display = 'none';
    this.wrapper.insertBefore(this.overflowMenu, this.editorContainer);

    // Initialize tools from content
    this.initializeTools();

    // Load pinned state from localStorage
    this.loadPinnedState();

    // Setup resize functionality
    this.setupResize();

    // Initial render
    this.render();

    // Add window resize listener to re-render on mobile/desktop changes
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.render();
      });
    }
  }

  private initializeTools() {
    this.content.forEach((group) => {
      group.forEach((element) => {
        const { dom, update } = element.render(this.editorView);
        const label = this.extractLabel(dom);
        const id = this.generateStableId(label, dom);

        this.tools.push({
          id,
          label,
          element,
          isPinned: false,
          updateFn: update,
        });
      });
    });
  }

  /**
   * Generate a stable ID from a label by converting it to a kebab-case slug.
   * Falls back to a hash if the label is empty or contains only special characters.
   */
  private generateStableId(label: string, dom: HTMLElement): string {
    // Try to use aria-label or data-id if available
    const ariaLabel = dom.getAttribute('aria-label');
    const dataId = dom.getAttribute('data-id');

    if (dataId) return `tool-${dataId}`;

    const baseLabel = ariaLabel || label;

    // Convert label to kebab-case slug
    const slug = baseLabel
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    // If slug is empty, generate a simple hash from the label
    if (!slug) {
      const hash = this.simpleHash(baseLabel);
      return `tool-${hash}`;
    }

    return `tool-${slug}`;
  }

  /**
   * Simple hash function for generating stable IDs from strings.
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private extractLabel(dom: HTMLElement): string {
    // Try to extract label from various places
    const ariaLabel = dom.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const title = dom.getAttribute('title');
    if (title) return title;

    const buttonText = dom.querySelector('.kb-dropdown__label')?.textContent
      ?.trim();
    if (buttonText) return buttonText;

    const spanText = dom.querySelector('span')?.textContent?.trim();
    if (spanText) return spanText;

    // Fallback to looking at SVG title
    const svgTitle = dom.querySelector('svg title')?.textContent?.trim();
    if (svgTitle) return svgTitle;

    return 'Unknown Tool';
  }

  private loadPinnedState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const pinnedIds = JSON.parse(saved) as string[];
        this.tools.forEach((tool) => {
          tool.isPinned = pinnedIds.includes(tool.id);
        });
      } else {
        // Default pinned items (first 8)
        this.tools.slice(0, MAX_PINNED_ITEMS).forEach((tool) => {
          tool.isPinned = true;
        });
      }
    } catch (e) {
      console.error('Failed to load pinned state:', e);
      // Default to first 8 items
      this.tools.slice(0, MAX_PINNED_ITEMS).forEach((tool) => {
        tool.isPinned = true;
      });
    }
  }

  private savePinnedState() {
    try {
      const pinnedIds = this.tools.filter((t) => t.isPinned).map((t) => t.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedIds));
    } catch (e) {
      console.error('Failed to save pinned state:', e);
    }
  }

  private render() {
    // Clear toolbar and overflow menu
    this.toolbar.innerHTML = '';
    this.overflowMenu.innerHTML = '';

    const pinnedTools = this.tools.filter((t) => t.isPinned);
    const overflowTools = this.tools.filter((t) => !t.isPinned);

    // Check if we're in mobile view (Bootstrap md breakpoint: < 768px)
    const isMobile = typeof window !== 'undefined' &&
      window.innerWidth < MOBILE_BREAKPOINT;
    const mobileLimit = 4;

    // In mobile, only show first 4 pinned tools in toolbar
    const visibleTools = isMobile
      ? pinnedTools.slice(0, mobileLimit)
      : pinnedTools;
    const mobileOverflowPinned = isMobile ? pinnedTools.slice(mobileLimit) : [];

    // Render visible pinned tools in toolbar
    visibleTools.forEach((tool) => {
      const { dom, update } = tool.element.render(this.editorView);
      const wrapper = document.createElement('span');
      wrapper.classList.add(CSS_PREFIX + '__item');
      wrapper.appendChild(dom);
      this.toolbar.appendChild(wrapper);
    });

    // Add separator before overflow button
    if (overflowTools.length > 0 || mobileOverflowPinned.length > 0) {
      const separator = document.createElement('div');
      separator.classList.add(CSS_PREFIX + '__separator');
      this.toolbar.appendChild(separator);
    }

    // Add overflow toggle button
    if (overflowTools.length > 0 || mobileOverflowPinned.length > 0) {
      const overflowToggle = document.createElement('button');
      overflowToggle.type = 'button';
      overflowToggle.className = CSS_PREFIX + '__overflow-toggle';
      overflowToggle.setAttribute('aria-haspopup', 'true');
      overflowToggle.setAttribute('aria-expanded', 'false');
      overflowToggle.title = 'More';
      overflowToggle.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="19" cy="12" r="2"/>
        </svg>
      `;

      overflowToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = this.overflowMenu.style.display !== 'none';
        this.overflowMenu.style.display = isOpen ? 'none' : 'block';
        overflowToggle.setAttribute('aria-expanded', String(!isOpen));
      });

      this.toolbar.appendChild(overflowToggle);
    }

    // Create scrollable content container
    const overflowContent = document.createElement('div');
    overflowContent.classList.add(CSS_PREFIX + '__overflow-content');

    // In mobile view, add the pinned overflow tools at the top with a label
    if (isMobile && mobileOverflowPinned.length > 0) {
      // Add section header
      const header = document.createElement('div');
      header.classList.add(CSS_PREFIX + '__overflow-header');
      header.textContent = 'More Tools';
      overflowContent.appendChild(header);

      // Add the overflow pinned tools
      mobileOverflowPinned.forEach((tool) => {
        const { dom, update } = tool.element.render(this.editorView);
        const wrapper = document.createElement('div');
        wrapper.classList.add(CSS_PREFIX + '__overflow-item');

        // Add label to the item
        const label = document.createElement('span');
        label.classList.add(CSS_PREFIX + '__overflow-item-label');
        label.textContent = tool.label;

        // Restructure the DOM to show icon + label
        wrapper.appendChild(dom);
        wrapper.appendChild(label);

        overflowContent.appendChild(wrapper);
      });

      // Add separator after mobile overflow pinned section
      if (overflowTools.length > 0) {
        const separator = document.createElement('div');
        separator.classList.add(CSS_PREFIX + '__overflow-separator');
        overflowContent.appendChild(separator);
      }
    }

    // Render overflow tools with labels
    overflowTools.forEach((tool) => {
      const { dom, update } = tool.element.render(this.editorView);
      const wrapper = document.createElement('div');
      wrapper.classList.add(CSS_PREFIX + '__overflow-item');

      // Add label to the item
      const label = document.createElement('span');
      label.classList.add(CSS_PREFIX + '__overflow-item-label');
      label.textContent = tool.label;

      // Restructure the DOM to show icon + label
      wrapper.appendChild(dom);
      wrapper.appendChild(label);

      overflowContent.appendChild(wrapper);
    });

    // Add the scrollable content to overflow menu
    this.overflowMenu.appendChild(overflowContent);

    // Create sticky footer for manage button
    if (
      overflowTools.length > 0 || pinnedTools.length > 0 ||
      mobileOverflowPinned.length > 0
    ) {
      const overflowFooter = document.createElement('div');
      overflowFooter.classList.add(CSS_PREFIX + '__overflow-footer');

      const manageButton = document.createElement('button');
      manageButton.type = 'button';
      manageButton.className = CSS_PREFIX + '__manage-button';
      manageButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-7l-1.5-1.5M21 12l-1.5 1.5M3 12l1.5 1.5M3 12l1.5-1.5M12 3v2m0 14v2"></path>
        </svg>
        <span>Manage Pinned Tools</span>
      `;
      manageButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.openManageModal();
      });

      overflowFooter.appendChild(manageButton);
      this.overflowMenu.appendChild(overflowFooter);
    }

    // Remove existing click-outside listener if any
    const doc = this.editorView.dom.ownerDocument || document;
    if (this.closeOverflowHandler) {
      doc.removeEventListener('click', this.closeOverflowHandler);
    }

    // Create and store close overflow handler
    this.closeOverflowHandler = (e: MouseEvent) => {
      if (
        !this.overflowMenu.contains(e.target as Node) &&
        !this.toolbar.contains(e.target as Node)
      ) {
        this.overflowMenu.style.display = 'none';
        const toggle = this.toolbar.querySelector(
          '.' + CSS_PREFIX + '__overflow-toggle',
        );
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
        }
      }
    };

    // Add new listener
    doc.addEventListener('click', this.closeOverflowHandler);
  }

  private openManageModal() {
    // Close overflow menu
    this.overflowMenu.style.display = 'none';

    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.classList.add(CSS_PREFIX + '__modal-backdrop');

    // Create modal
    this.modal = document.createElement('div');
    this.modal.classList.add(CSS_PREFIX + '__modal');

    // Modal header
    const header = document.createElement('div');
    header.classList.add(CSS_PREFIX + '__modal-header');
    header.innerHTML = `
      <h2>Manage Pinned Tools</h2>
      <button type="button" class="${CSS_PREFIX}__modal-close" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 6l12 12M6 18L18 6"/>
        </svg>
      </button>
    `;

    // Modal message
    const message = document.createElement('div');
    message.classList.add(CSS_PREFIX + '__modal-message');
    message.textContent = `Maximum pinned: ${MAX_PINNED_ITEMS}`;

    // Modal content (tool list)
    const content = document.createElement('div');
    content.classList.add(CSS_PREFIX + '__modal-content');

    const toolList = document.createElement('div');
    toolList.classList.add(CSS_PREFIX + '__tool-list');

    this.tools.forEach((tool) => {
      const toolItem = document.createElement('label');
      toolItem.classList.add(CSS_PREFIX + '__tool-item');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = tool.isPinned;
      checkbox.disabled = false;

      const pinnedCount = this.tools.filter((t) => t.isPinned).length;

      // Disable unchecked items if we've reached the limit
      if (!tool.isPinned && pinnedCount >= MAX_PINNED_ITEMS) {
        checkbox.disabled = true;
        toolItem.classList.add(CSS_PREFIX + '__tool-item--disabled');
      }

      checkbox.addEventListener('change', () => {
        const currentPinnedCount = this.tools.filter((t) => t.isPinned).length;

        if (checkbox.checked) {
          if (currentPinnedCount >= MAX_PINNED_ITEMS) {
            checkbox.checked = false;
            return;
          }
          tool.isPinned = true;
        } else {
          tool.isPinned = false;
        }

        this.savePinnedState();
        this.updateModalState(toolList);
      });

      const label = document.createElement('span');
      label.textContent = tool.label;

      toolItem.appendChild(checkbox);
      toolItem.appendChild(label);
      toolList.appendChild(toolItem);
    });

    content.appendChild(toolList);

    // Modal footer
    const footer = document.createElement('div');
    footer.classList.add(CSS_PREFIX + '__modal-footer');
    footer.innerHTML = `
      <button type="button" class="${CSS_PREFIX}__modal-button ${CSS_PREFIX}__modal-button--primary">
        Done
      </button>
    `;

    // Assemble modal
    this.modal.appendChild(header);
    this.modal.appendChild(message);
    this.modal.appendChild(content);
    this.modal.appendChild(footer);
    backdrop.appendChild(this.modal);

    // Add to DOM
    (this.editorView.dom.ownerDocument || document).body.appendChild(backdrop);

    // Close handlers
    const closeModal = () => {
      backdrop.remove();
      this.modal = null;
      this.render(); // Re-render toolbar with new pinned state
    };

    header.querySelector('.' + CSS_PREFIX + '__modal-close')?.addEventListener(
      'click',
      closeModal,
    );
    footer.querySelector('.' + CSS_PREFIX + '__modal-button')?.addEventListener(
      'click',
      closeModal,
    );
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });
  }

  private updateModalState(toolList: HTMLElement) {
    const pinnedCount = this.tools.filter((t) => t.isPinned).length;
    const items = toolList.querySelectorAll('.' + CSS_PREFIX + '__tool-item');

    items.forEach((item, index) => {
      const checkbox = item.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      const tool = this.tools[index];

      if (!tool.isPinned && pinnedCount >= MAX_PINNED_ITEMS) {
        checkbox.disabled = true;
        item.classList.add(CSS_PREFIX + '__tool-item--disabled');
      } else if (!tool.isPinned) {
        checkbox.disabled = false;
        item.classList.remove(CSS_PREFIX + '__tool-item--disabled');
      }
    });
  }

  private setupResize() {
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    const onMouseDown = (e: MouseEvent) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = this.editorContainer.offsetHeight;

      // Add resizing class for visual feedback
      this.wrapper.classList.add(CSS_PREFIX + '__wrapper--resizing');

      // Prevent text selection while dragging
      e.preventDefault();

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaY = e.clientY - startY;
      const newHeight = startHeight + deltaY;

      // Set minimum and maximum heights
      const minHeight = 200;
      const maxHeight = window.innerHeight - 100;

      if (newHeight >= minHeight && newHeight <= maxHeight) {
        this.editorContainer.style.height = newHeight + 'px';
      }
    };

    const onMouseUp = () => {
      if (!isResizing) return;

      isResizing = false;
      this.wrapper.classList.remove(CSS_PREFIX + '__wrapper--resizing');

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    this.resizeHandle.addEventListener('mousedown', onMouseDown);
  }

  update(view: EditorView, prevState: EditorState) {
    // Efficiently update tool states using stored update functions
    this.tools.forEach((tool) => {
      tool.updateFn(view.state);
    });
  }

  destroy() {
    // Clean up event listeners
    const doc = this.editorView.dom.ownerDocument || document;
    if (this.closeOverflowHandler) {
      doc.removeEventListener('click', this.closeOverflowHandler);
      this.closeOverflowHandler = null;
    }

    // Clean up modal
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }

    // Clean up DOM
    if (this.wrapper.parentNode) {
      this.wrapper.parentNode.replaceChild(this.editorView.dom, this.wrapper);
    }
  }
}

export interface CustomMenuOptions {
  /// Provides the content of the menu
  content: readonly (readonly MenuElement[])[];
}

export class CustomMenuPlugin extends Plugin {
  constructor(editor: CoreEditor, options: CustomMenuOptions) {
    super({
      view(editorView) {
        return new CustomMenuView(editorView, editor, options.content);
      },
    });
  }
}

/// Extension for a customizable menu with pinned items
export class ExtensionCustomMenu extends Extension {
  name = 'customMenu';

  getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    const content = buildMenu(editor, schema);

    return [
      new CustomMenuPlugin(editor, {
        content,
      }),
    ];
  }
}
