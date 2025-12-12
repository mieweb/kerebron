import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import type { CoreEditor } from '@kerebron/editor';

import { CustomMenuOptions } from './ExtensionCustomMenu.ts';

import type { MenuElement } from './menu.ts';

const CSS_PREFIX = 'kb-custom-menu';

interface ToolItem {
  id: string;
  label: string;
  element: MenuElement;
  wrapper?: HTMLElement;
  width?: number; // Cached width for performance
}

/**
 * Dynamic Custom Menu View with Google Docs-style overflow
 * All items start visible, overflow items move to secondary toolbar as screen shrinks
 */
export class CustomMenuViewDynamic {
  wrapper: HTMLElement;
  toolbar: HTMLElement; // Primary toolbar
  secondaryToolbar: HTMLElement; // Secondary overflow toolbar (Google Docs style)
  overflowButton: HTMLElement;
  editorContainer: HTMLElement;
  resizeHandle: HTMLElement;
  root: Document | ShadowRoot;

  private tools: ToolItem[] = [];
  private primaryToolIds: Set<string> = new Set();
  private secondaryToolIds: Set<string> = new Set();
  private resizeObserver: ResizeObserver | null = null;
  private isSecondaryToolbarVisible: boolean = false;
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    readonly editorView: EditorView,
    readonly editor: CoreEditor,
    readonly content: readonly (readonly MenuElement[])[],
  ) {
    this.root = editorView.root;

    // Create wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add(CSS_PREFIX + '__wrapper');

    // Create primary toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.classList.add(CSS_PREFIX);
    this.toolbar.classList.add(CSS_PREFIX + '--dynamic');
    this.toolbar.setAttribute('role', 'toolbar');

    // Create secondary overflow toolbar (initially hidden)
    this.secondaryToolbar = document.createElement('div');
    this.secondaryToolbar.classList.add(CSS_PREFIX + '__secondary-toolbar');
    this.secondaryToolbar.setAttribute('role', 'toolbar');
    this.secondaryToolbar.setAttribute('aria-label', 'Additional tools');
    this.secondaryToolbar.style.display = 'none';

    // Create overflow toggle button (three dots icon)
    this.overflowButton = document.createElement('button');
    this.overflowButton.type = 'button';
    this.overflowButton.className = CSS_PREFIX + '__overflow-toggle';
    this.overflowButton.setAttribute('aria-label', 'More tools');
    this.overflowButton.setAttribute('aria-expanded', 'false');
    this.overflowButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="2"/>
        <circle cx="12" cy="12" r="2"/>
        <circle cx="19" cy="12" r="2"/>
      </svg>
    `;
    this.overflowButton.style.display = 'none'; // Hidden when no overflow
    this.overflowButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSecondaryToolbar();
    });

    // Create editor container with resize handle
    this.editorContainer = document.createElement('div');
    this.editorContainer.classList.add(CSS_PREFIX + '__editor-container');
    this.editorContainer.style.height = '50vh';

    // Create resize handle
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.classList.add(CSS_PREFIX + '__resize-handle');
    this.resizeHandle.innerHTML = '<div class="' + CSS_PREFIX +
      '__resize-handle-bar"></div>';

    // Mount structure
    this.wrapper.appendChild(this.toolbar);
    this.wrapper.appendChild(this.secondaryToolbar);
    if (editorView.dom.parentNode) {
      editorView.dom.parentNode.replaceChild(this.wrapper, editorView.dom);
    }

    // Wrap editor in container and add resize handle
    this.editorContainer.appendChild(editorView.dom);
    this.editorContainer.appendChild(this.resizeHandle);
    this.wrapper.appendChild(this.editorContainer);

    // Initialize tools from content
    this.initializeTools();

    // Setup resize functionality
    this.setupResize();

    // Initial render - all tools in primary toolbar
    this.renderPrimaryToolbar();

    // Append overflow button to primary toolbar
    this.toolbar.appendChild(this.overflowButton);

    // Setup dynamic overflow detection
    this.setupOverflowDetection();
  }

  private initializeTools() {
    this.content.forEach((group) => {
      group.forEach((element) => {
        const { dom } = element.render(this.editorView);

        // Extract label
        let label: string;
        const dropdown = element as any;
        if (dropdown.options && dropdown.options.label) {
          label = dropdown.options.label;
        } else {
          label = this.extractLabel(dom);
        }

        const id = this.generateStableId(label);

        this.tools.push({
          id,
          label,
          element,
        });
      });
    });
  }

  private generateStableId(label: string): string {
    // Simple stable hash based on label
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      const char = label.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'tool-' + Math.abs(hash).toString(36);
  }

  private extractLabel(dom: HTMLElement): string {
    const buttonText = dom.querySelector('span')?.textContent?.trim();
    if (buttonText) return buttonText;

    const dropdownLabel = dom.querySelector('.kb-dropdown__label')?.textContent
      ?.trim();
    if (dropdownLabel) return dropdownLabel;

    const ariaLabel = dom.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const title = dom.getAttribute('title');
    if (title) return title;

    const svgTitle = dom.querySelector('svg title')?.textContent?.trim();
    if (svgTitle) return svgTitle;

    return 'tool-' + Math.random().toString(36).substr(2, 9);
  }

  private renderPrimaryToolbar() {
    // Clear toolbar (but keep overflow button which we'll re-append)
    this.toolbar.innerHTML = '';
    this.primaryToolIds.clear();

    // Render all tools initially in primary toolbar
    this.tools.forEach((tool) => {
      const wrapper = document.createElement('span');
      wrapper.classList.add(CSS_PREFIX + '__item');
      wrapper.setAttribute('data-tool-id', tool.id);

      // Render the tool
      const { dom } = tool.element.render(this.editorView);
      wrapper.appendChild(dom);

      // Store reference
      tool.wrapper = wrapper;

      this.toolbar.appendChild(wrapper);
      this.primaryToolIds.add(tool.id);
    });
  }

  private renderSecondaryToolbar() {
    // Clear secondary toolbar
    this.secondaryToolbar.innerHTML = '';

    // Render overflow tools in secondary toolbar
    this.tools.forEach((tool) => {
      if (this.secondaryToolIds.has(tool.id) && tool.wrapper) {
        this.secondaryToolbar.appendChild(tool.wrapper);
      }
    });
  }

  private toggleSecondaryToolbar() {
    this.isSecondaryToolbarVisible = !this.isSecondaryToolbarVisible;

    if (this.isSecondaryToolbarVisible) {
      this.secondaryToolbar.style.display = 'flex';
      this.overflowButton.setAttribute('aria-expanded', 'true');
      this.overflowButton.classList.add(
        CSS_PREFIX + '__overflow-toggle--active',
      );

      // Add click-outside handler
      setTimeout(() => {
        this.clickOutsideHandler = (e: MouseEvent) => {
          const target = e.target as Node;
          // Close if click is outside both the secondary toolbar and the overflow button
          if (
            !this.secondaryToolbar.contains(target) &&
            !this.overflowButton.contains(target)
          ) {
            this.closeSecondaryToolbar();
          }
        };
        document.addEventListener('click', this.clickOutsideHandler);
      }, 0);
    } else {
      this.closeSecondaryToolbar();
    }
  }

  private closeSecondaryToolbar() {
    this.secondaryToolbar.style.display = 'none';
    this.overflowButton.setAttribute('aria-expanded', 'false');
    this.overflowButton.classList.remove(
      CSS_PREFIX + '__overflow-toggle--active',
    );
    this.isSecondaryToolbarVisible = false;

    // Remove click-outside handler
    if (this.clickOutsideHandler) {
      document.removeEventListener('click', this.clickOutsideHandler);
      this.clickOutsideHandler = null;
    }
  }

  private setupOverflowDetection() {
    // Use ResizeObserver to detect when toolbar width changes
    this.resizeObserver = new ResizeObserver(() => {
      this.handleOverflow();
    });

    this.resizeObserver.observe(this.toolbar);
  }

  private handleOverflow() {
    // Get available width (toolbar width minus overflow button width)
    const toolbarWidth = this.toolbar.offsetWidth;
    const overflowButtonWidth = 40; // Approximate width of >> button
    const availableWidth = toolbarWidth - overflowButtonWidth - 20; // 20px margin

    let currentWidth = 0;
    const itemsToMove: string[] = [];

    // Calculate which items fit in primary toolbar
    this.tools.forEach((tool) => {
      if (!tool.wrapper) return;

      // Get or cache item width
      if (!tool.width) {
        // Temporarily append to measure if not already in DOM
        const wasInPrimary = this.toolbar.contains(tool.wrapper);
        if (!wasInPrimary) {
          this.toolbar.appendChild(tool.wrapper);
        }
        tool.width = tool.wrapper.offsetWidth + 4; // 4px gap
        if (!wasInPrimary) {
          tool.wrapper.remove();
        }
      }

      if (currentWidth + tool.width <= availableWidth) {
        currentWidth += tool.width;
        // Keep in primary
        if (!this.primaryToolIds.has(tool.id)) {
          this.primaryToolIds.add(tool.id);
          this.secondaryToolIds.delete(tool.id);
        }
      } else {
        // Move to secondary
        itemsToMove.push(tool.id);
        if (!this.secondaryToolIds.has(tool.id)) {
          this.secondaryToolIds.add(tool.id);
          this.primaryToolIds.delete(tool.id);
        }
      }
    });

    // Update toolbar layouts
    this.updateToolbarLayout();

    // Show/hide overflow button based on whether there are overflow items
    if (this.secondaryToolIds.size > 0) {
      this.overflowButton.style.display = 'inline-flex';
    } else {
      this.overflowButton.style.display = 'none';
      // Also hide secondary toolbar if no items
      if (this.isSecondaryToolbarVisible) {
        this.toggleSecondaryToolbar();
      }
    }
  }

  private updateToolbarLayout() {
    // Move items between toolbars based on primaryToolIds and secondaryToolIds
    this.tools.forEach((tool) => {
      if (!tool.wrapper) return;

      if (this.primaryToolIds.has(tool.id)) {
        // Should be in primary toolbar
        if (!this.toolbar.contains(tool.wrapper)) {
          // Insert before overflow button
          this.toolbar.insertBefore(tool.wrapper, this.overflowButton);
        }
      } else if (this.secondaryToolIds.has(tool.id)) {
        // Should be in secondary toolbar
        if (!this.secondaryToolbar.contains(tool.wrapper)) {
          this.secondaryToolbar.appendChild(tool.wrapper);
        }
      }
    });
  }

  private setupResize() {
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaY = e.clientY - startY;
      const newHeight = startHeight + deltaY;

      // Min height 200px, max 90vh
      const minHeight = 200;
      const maxHeight = window.innerHeight * 0.9;
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

      this.editorContainer.style.height = `${clampedHeight}px`;
    };

    const onMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    this.resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = this.editorContainer.offsetHeight;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      e.preventDefault();
    });
  }

  update(view: EditorView, prevState: EditorState) {
    // Re-render tools on state update
    this.tools.forEach((tool) => {
      if (tool.wrapper && tool.wrapper.firstChild) {
        const { dom, update } = tool.element.render(view);
        if (update) {
          update(view.state);
        }
      }
    });
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // Clean up click-outside handler
    if (this.clickOutsideHandler) {
      document.removeEventListener('click', this.clickOutsideHandler);
      this.clickOutsideHandler = null;
    }

    // Restore editor position
    if (this.wrapper.parentNode) {
      this.wrapper.parentNode.replaceChild(
        this.editorView.dom,
        this.wrapper,
      );
    }
  }
}

export class CustomMenuPluginDynamic extends Plugin {
  constructor(editor: CoreEditor, options: CustomMenuOptions) {
    super({
      view(editorView) {
        return new CustomMenuViewDynamic(editorView, editor, options.content);
      },
    });
  }
}
