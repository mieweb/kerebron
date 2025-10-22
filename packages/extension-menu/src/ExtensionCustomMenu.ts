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
  private submenuStack: Array<{ title: string; tools: ToolItem[] }> = [];

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

        // For dropdowns, get the label from the element's options directly
        let label: string;
        const dropdown = element as any;
        if (dropdown.options && dropdown.options.label) {
          label = dropdown.options.label;
        } else {
          label = this.extractLabel(dom);
        }

        const id = this.generateStableId(label, dom);

        // Skip "Select parent node" tool
        if (id === 'tool-select-parent-node') {
          return;
        }

        this.tools.push({
          id,
          label,
          element,
          isPinned: false,
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
    // For menu buttons with both icon and label, find the label span
    // The label span is the one that doesn't contain an SVG and isn't the icon span
    const spans = dom.querySelectorAll('span');
    if (spans.length > 1) {
      // If there are multiple spans, the last one is usually the label
      const lastSpan = spans[spans.length - 1];
      const text = lastSpan.textContent?.trim();
      if (text) return text;
    } else if (spans.length === 1) {
      // Single span - could be icon or label, check if it's just text
      const span = spans[0];
      const text = span.textContent?.trim();
      // If the span contains SVG, skip it (it's an icon container)
      if (text && !span.querySelector('svg')) return text;
    }

    // For dropdowns, check the dropdown label
    const dropdownLabel = dom.querySelector('.kb-dropdown__label')?.textContent
      ?.trim();
    if (dropdownLabel) return dropdownLabel;

    // Try aria-label as fallback
    const ariaLabel = dom.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Try title attribute
    const title = dom.getAttribute('title');
    if (title) return title;

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

  private showSubmenu(tool: ToolItem) {
    const dropdown = tool.element as any;
    if (!dropdown.content) return;

    // Extract sub-items from dropdown
    const subItems: ToolItem[] = dropdown.content.map(
      (element: MenuElement, index: number) => {
        const { dom } = element.render(this.editorView);

        // For nested dropdowns, get the label from options directly
        let label: string;
        const nestedDropdown = element as any;
        if (nestedDropdown.options && nestedDropdown.options.label) {
          label = nestedDropdown.options.label;
        } else {
          label = this.extractLabel(dom);
        }

        return {
          id: `${tool.id}-sub-${index}`,
          label,
          element,
          isPinned: false,
        };
      },
    );

    // Save current state to stack
    this.submenuStack.push({
      title: tool.label,
      tools: subItems,
    });

    // Re-render to show submenu
    this.renderOverflowMenu();
  }

  private goBack() {
    // Remove last submenu from stack
    this.submenuStack.pop();

    // Re-render
    this.renderOverflowMenu();
  }

  private renderOverflowMenu() {
    // Clear overflow menu
    this.overflowMenu.innerHTML = '';

    // Check if we're showing a submenu
    const isSubmenu = this.submenuStack.length > 0;
    const currentSubmenu = isSubmenu
      ? this.submenuStack[this.submenuStack.length - 1]
      : null;

    // Create scrollable content container
    const overflowContent = document.createElement('div');
    overflowContent.classList.add(CSS_PREFIX + '__overflow-content');

    if (isSubmenu && currentSubmenu) {
      // Render submenu header with back button
      const header = document.createElement('div');
      header.classList.add(CSS_PREFIX + '__overflow-submenu-header');

      const backButton = document.createElement('button');
      backButton.type = 'button';
      backButton.classList.add(CSS_PREFIX + '__overflow-back-button');
      backButton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 19l-7-7 7-7"/></svg>';
      backButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.goBack();
      });

      const title = document.createElement('span');
      title.classList.add(CSS_PREFIX + '__overflow-submenu-title');
      title.textContent = currentSubmenu.title;

      header.appendChild(backButton);
      header.appendChild(title);
      overflowContent.appendChild(header);

      // Render submenu items
      currentSubmenu.tools.forEach((tool) => {
        // Check if this is a nested dropdown
        const isDropdown = (tool.element as any).content !== undefined;

        const wrapper = document.createElement('div');
        wrapper.classList.add(CSS_PREFIX + '__overflow-item');
        wrapper.setAttribute('data-tool-id', tool.id);

        if (isDropdown) {
          // For nested dropdowns, just show label and chevron (no icon/button)
          // Add label
          const label = document.createElement('span');
          label.classList.add(CSS_PREFIX + '__overflow-item-label');
          label.textContent = tool.label;
          wrapper.appendChild(label);

          // Add chevron to indicate submenu
          const chevron = document.createElement('span');
          chevron.classList.add(CSS_PREFIX + '__overflow-item-chevron');
          chevron.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>';
          wrapper.appendChild(chevron);

          // Click handler for nested dropdown - navigate deeper
          wrapper.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showSubmenu(tool);
          });
        } else {
          // Regular menu item
          const { dom, update } = tool.element.render(this.editorView);

          // Hide the button's internal label span to avoid duplication
          // Be more specific - only hide spans that contain text and are direct label spans
          // Don't hide spans that are part of the icon (inside .kb-icon or custom icon DOM)
          const spans = dom.querySelectorAll('span');
          spans.forEach((span) => {
            // Check if this span is inside a .kb-icon container (part of the icon)
            const isInsideIcon = span.closest('.kb-icon') !== null;
            
            // Only hide spans that are likely labels:
            // - Have text content
            // - Are not inside a .kb-icon container
            // - Don't contain SVG children  
            // - Don't have kb-icon class themselves
            // - Are direct children of the button (not nested deeper)
            const isDirectChild = span.parentElement === dom;
            
            if (span.textContent && span.textContent.trim() && 
                !isInsideIcon &&
                isDirectChild &&
                !span.querySelector('svg') && 
                !span.classList.contains('kb-icon')) {
              span.style.display = 'none';
            }
          });

          // Add our own label to the item
          const label = document.createElement('span');
          label.classList.add(CSS_PREFIX + '__overflow-item-label');
          label.textContent = tool.label;

          // Restructure the DOM to show icon + label
          wrapper.appendChild(dom);
          wrapper.appendChild(label);

          // Make the entire wrapper clickable by dispatching mousedown to the button
          wrapper.addEventListener('mousedown', (e) => {
            if (e.target !== dom) {
              e.preventDefault();
              const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
              });
              dom.dispatchEvent(mousedownEvent);
            }
          });
        }

        wrapper.setAttribute('data-tool-id', tool.id);
        overflowContent.appendChild(wrapper);
      });
    } else {
      // Render main overflow menu
      const pinnedTools = this.tools.filter((t) => t.isPinned);
      let overflowTools = this.tools.filter((t) => !t.isPinned);

      // Sort overflow tools to put Insert and Type first
      overflowTools = overflowTools.sort((a, b) => {
        const aIsInsertOrType = a.label === 'Insert' || a.label === 'Type';
        const bIsInsertOrType = b.label === 'Insert' || b.label === 'Type';
        if (aIsInsertOrType && !bIsInsertOrType) return -1;
        if (!aIsInsertOrType && bIsInsertOrType) return 1;
        if (a.label === 'Insert' && b.label === 'Type') return -1;
        if (a.label === 'Type' && b.label === 'Insert') return 1;
        return 0;
      });

      // Check if we're in mobile view
      const isMobile = typeof window !== 'undefined' &&
        window.innerWidth < MOBILE_BREAKPOINT;
      const mobileLimit = 4;
      const mobileOverflowPinned = isMobile
        ? pinnedTools.slice(mobileLimit)
        : [];

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
          wrapper.setAttribute('data-tool-id', tool.id);

          // Hide the button's internal label span to avoid duplication
          const spans = dom.querySelectorAll('span');
          spans.forEach((span) => {
            const isInsideIcon = span.closest('.kb-icon') !== null;
            const isDirectChild = span.parentElement === dom;
            if (span.textContent && span.textContent.trim() && 
                !isInsideIcon &&
                isDirectChild &&
                !span.querySelector('svg') && 
                !span.classList.contains('kb-icon')) {
              span.style.display = 'none';
            }
          });

          // Add label to the item
          const label = document.createElement('span');
          label.classList.add(CSS_PREFIX + '__overflow-item-label');
          label.textContent = tool.label;

          // Restructure the DOM to show icon + label
          wrapper.appendChild(dom);
          wrapper.appendChild(label);

          // Make the entire wrapper clickable by dispatching mousedown to the button
          wrapper.addEventListener('mousedown', (e) => {
            if (e.target !== dom) {
              e.preventDefault();
              const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
              });
              dom.dispatchEvent(mousedownEvent);
            }
          });

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
        // Check if this is a dropdown with sub-items
        const isDropdown = (tool.element as any).content !== undefined;

        const wrapper = document.createElement('div');
        wrapper.classList.add(CSS_PREFIX + '__overflow-item');
        wrapper.setAttribute('data-tool-id', tool.id);

        if (isDropdown) {
          // For dropdowns, create a custom button with icon and chevron
          const button = document.createElement('button');
          button.type = 'button';
          button.classList.add('kb-menu__button');

          // Add an icon (we'll use a document icon for Type menu)
          const icon = document.createElement('svg');
          icon.setAttribute('viewBox', '0 0 24 24');
          icon.setAttribute('fill', 'none');
          icon.setAttribute('stroke', 'currentColor');
          icon.setAttribute('stroke-width', '2');
          icon.innerHTML =
            '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>';
          button.appendChild(icon);

          wrapper.appendChild(button);

          // Add label
          const label = document.createElement('span');
          label.classList.add(CSS_PREFIX + '__overflow-item-label');
          label.textContent = tool.label;
          wrapper.appendChild(label);

          // Add chevron to indicate submenu
          const chevron = document.createElement('span');
          chevron.classList.add(CSS_PREFIX + '__overflow-item-chevron');
          chevron.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>';
          wrapper.appendChild(chevron);

          // Click handler for dropdown - navigate to submenu
          wrapper.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showSubmenu(tool);
          });
        } else {
          // Regular menu item
          const { dom, update } = tool.element.render(this.editorView);

          // Hide the button's internal label span to avoid duplication
          const spans = dom.querySelectorAll('span');
          spans.forEach((span) => {
            const isInsideIcon = span.closest('.kb-icon') !== null;
            const isDirectChild = span.parentElement === dom;
            if (span.textContent && span.textContent.trim() && 
                !isInsideIcon &&
                isDirectChild &&
                !span.querySelector('svg') && 
                !span.classList.contains('kb-icon')) {
              span.style.display = 'none';
            }
          });

          // Add label to the item
          const label = document.createElement('span');
          label.classList.add(CSS_PREFIX + '__overflow-item-label');
          label.textContent = tool.label;

          // Restructure the DOM to show icon + label
          wrapper.appendChild(dom);
          wrapper.appendChild(label);

          // Make the entire wrapper clickable by dispatching mousedown to the button
          wrapper.addEventListener('mousedown', (e) => {
            if (e.target !== dom) {
              e.preventDefault();
              const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
              });
              dom.dispatchEvent(mousedownEvent);
            }
          });
        }

        overflowContent.appendChild(wrapper);
      });
    }

    // Add the scrollable content to overflow menu
    this.overflowMenu.appendChild(overflowContent);

    // Create sticky footer for manage button (only in main menu, not submenu)
    if (
      !isSubmenu &&
      (this.tools.filter((t) => !t.isPinned).length > 0 ||
        this.tools.filter((t) => t.isPinned).length > 0)
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
  }

  private render() {
    // Clear toolbar and overflow menu
    this.toolbar.innerHTML = '';
    this.overflowMenu.innerHTML = '';

    const pinnedTools = this.tools.filter((t) => t.isPinned);
    let overflowTools = this.tools.filter((t) => !t.isPinned);

    // Sort overflow tools to put Insert and Type first
    overflowTools = overflowTools.sort((a, b) => {
      const aIsInsertOrType = a.label === 'Insert' || a.label === 'Type';
      const bIsInsertOrType = b.label === 'Insert' || b.label === 'Type';
      if (aIsInsertOrType && !bIsInsertOrType) return -1;
      if (!aIsInsertOrType && bIsInsertOrType) return 1;
      if (a.label === 'Insert' && b.label === 'Type') return -1;
      if (a.label === 'Type' && b.label === 'Insert') return 1;
      return 0;
    });

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
      wrapper.setAttribute('data-tool-id', tool.id);
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
        e.stopPropagation();
        const isOpen = this.overflowMenu.style.display !== 'none';
        this.overflowMenu.style.display = isOpen ? 'none' : 'block';
        overflowToggle.setAttribute('aria-expanded', String(!isOpen));

        // Add/remove close handler based on open state
        const doc = this.editorView.dom.ownerDocument || document;
        if (!isOpen) {
          // Opening - reset submenu stack to show main menu
          this.submenuStack = [];
          this.renderOverflowMenu();

          // Opening - add close handler after a short delay
          setTimeout(() => {
            if (this.closeOverflowHandler) {
              doc.removeEventListener('click', this.closeOverflowHandler);
            }
            this.closeOverflowHandler = (e: MouseEvent) => {
              // Don't interfere with editor clicks
              const target = e.target as Node;
              const editorDom = this.editorView.dom;

              // Check if click is inside editor
              if (editorDom.contains(target)) {
                return; // Let editor handle it
              }

              if (
                !this.overflowMenu.contains(target) &&
                !this.toolbar.contains(target)
              ) {
                this.overflowMenu.style.display = 'none';
                overflowToggle.setAttribute('aria-expanded', 'false');
                // Clear submenu stack when closing
                this.submenuStack = [];
                if (this.closeOverflowHandler) {
                  doc.removeEventListener('click', this.closeOverflowHandler);
                }
              }
            };
            doc.addEventListener('click', this.closeOverflowHandler);
          }, 0);
        } else {
          // Closing - remove close handler and clear submenu stack
          if (this.closeOverflowHandler) {
            doc.removeEventListener('click', this.closeOverflowHandler);
          }
          this.submenuStack = [];
        }
      });

      this.toolbar.appendChild(overflowToggle);
    }

    // Render overflow menu content
    this.renderOverflowMenu();
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
    // Re-render tools to update their state (original approach)
    // Note: This is less efficient but more reliable than storing update functions
    this.tools.forEach((tool) => {
      tool.element.render(this.editorView);
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
