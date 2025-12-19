// deno-lint-ignore-file no-window

import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import type { CoreEditor } from '@kerebron/editor';

import { CustomMenuOptions } from './ExtensionCustomMenu.ts';

import type { MenuElement } from './menu.ts';

const CSS_PREFIX = 'kb-custom-menu';
const STORAGE_KEY = 'kb-custom-menu-order';
// Minimum width for overflow toggle button + some padding
const OVERFLOW_BUTTON_WIDTH = 48;
// Approximate width per toolbar item
const ITEM_WIDTH = 40;
// Delay before drag starts (ms) - user must hold before dragging
const DRAG_START_DELAY = 150;

interface ToolItem {
  id: string;
  label: string;
  element: MenuElement;
  order: number;
}

export class CustomMenuView {
  wrapper: HTMLElement;
  toolbar: HTMLElement;
  overflowMenu: HTMLElement;
  pinnedDropdownMenu: HTMLElement | null = null;
  tools: ToolItem[] = [];
  root: Document | ShadowRoot;
  resizeHandle: HTMLElement;
  editorContainer: HTMLElement;
  private closeOverflowHandler: ((e: MouseEvent) => void) | null = null;
  private closePinnedDropdownHandler: ((e: MouseEvent) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private submenuStack: Array<{ title: string; tools: ToolItem[] }> = [];
  private pinnedDropdownStack: Array<
    { title: string; tools: ToolItem[]; rootTool: ToolItem }
  > = [];
  private resizeObserver: ResizeObserver | null = null;

  // Drag and drop state
  private draggedItem: ToolItem | null = null;
  private dragStartTimer: number | null = null;
  private isDragging = false;
  private dragPlaceholder: HTMLElement | null = null;
  private dragGhost: HTMLElement | null = null;

  // Current overflow tools (calculated during render)
  private currentOverflowTools: ToolItem[] = [];

  // Currently focused toolbar item index for keyboard navigation
  private focusedToolbarIndex = -1;

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

    // Load order state from localStorage
    this.loadOrderState();

    // Setup resize functionality
    this.setupResize();

    // Initial render
    this.render();

    // Use ResizeObserver to dynamically show/hide items based on available width
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.render();
      });
      this.resizeObserver.observe(this.toolbar);
    }

    // Setup keyboard navigation for accessibility
    this.setupKeyboardNavigation();
  }

  /**
   * Close all open menus (overflow menu and pinned dropdowns).
   * Optionally returns focus to a specific element.
   */
  private closeAllMenus(returnFocusTo?: HTMLElement) {
    // Close overflow menu
    if (this.overflowMenu.style.display !== 'none') {
      this.overflowMenu.style.display = 'none';
      this.submenuStack = [];
      const overflowToggle = this.toolbar.querySelector(
        '.' + CSS_PREFIX + '__overflow-toggle',
      ) as HTMLElement;
      if (overflowToggle) {
        overflowToggle.setAttribute('aria-expanded', 'false');
      }
    }

    // Close pinned dropdown
    if (this.pinnedDropdownMenu) {
      this.pinnedDropdownMenu.remove();
      this.pinnedDropdownMenu = null;
      this.pinnedDropdownStack = [];
    }

    // Return focus if specified
    if (returnFocusTo) {
      returnFocusTo.focus();
    }
  }

  /**
   * Get all focusable toolbar items (buttons).
   */
  private getToolbarButtons(): HTMLButtonElement[] {
    const buttons: HTMLButtonElement[] = [];
    const items = this.toolbar.querySelectorAll('.' + CSS_PREFIX + '__item');
    items.forEach((item) => {
      const button = item.querySelector('button') as HTMLButtonElement;
      if (button) buttons.push(button);
    });
    // Add overflow toggle if present
    const overflowToggle = this.toolbar.querySelector(
      '.' + CSS_PREFIX + '__overflow-toggle',
    ) as HTMLButtonElement;
    if (overflowToggle) buttons.push(overflowToggle);
    return buttons;
  }

  /**
   * Setup keyboard navigation for toolbar (WCAG toolbar pattern).
   * - Left/Right arrows move between items
   * - Home/End jump to first/last item
   * - Escape closes menus
   */
  private setupKeyboardNavigation() {
    this.keydownHandler = (e: KeyboardEvent) => {
      // Check if focus is within toolbar
      const activeElement = document.activeElement as HTMLElement;
      const isInToolbar = this.toolbar.contains(activeElement);
      const isInOverflowMenu = this.overflowMenu.contains(activeElement);
      const isInPinnedDropdown = this.pinnedDropdownMenu?.contains(
        activeElement,
      );

      // Handle Escape key - close menus
      if (e.key === 'Escape') {
        if (isInPinnedDropdown || this.pinnedDropdownMenu) {
          e.preventDefault();
          const lastFocused = this.toolbar.querySelector(
            '[data-last-focused="true"]',
          ) as HTMLElement;
          this.closeAllMenus(lastFocused || undefined);
          return;
        }
        if (isInOverflowMenu || this.overflowMenu.style.display !== 'none') {
          e.preventDefault();
          const overflowToggle = this.toolbar.querySelector(
            '.' + CSS_PREFIX + '__overflow-toggle',
          ) as HTMLElement;
          this.closeAllMenus(overflowToggle || undefined);
          return;
        }
      }

      // Arrow key navigation within toolbar
      if (isInToolbar && !isInOverflowMenu && !isInPinnedDropdown) {
        const buttons = this.getToolbarButtons();
        const currentIndex = buttons.indexOf(
          activeElement as HTMLButtonElement,
        );

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % buttons.length;
          buttons[nextIndex]?.focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prevIndex = (currentIndex - 1 + buttons.length) %
            buttons.length;
          buttons[prevIndex]?.focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          buttons[0]?.focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          buttons[buttons.length - 1]?.focus();
        }
      }

      // Arrow key navigation within overflow menu
      if (isInOverflowMenu) {
        const focusableItems = Array.from(
          this.overflowMenu.querySelectorAll(
            'button, [role="menuitem"], .' + CSS_PREFIX + '__overflow-item',
          ),
        ) as HTMLElement[];
        const currentIndex = focusableItems.indexOf(activeElement);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % focusableItems.length;
          focusableItems[nextIndex]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = (currentIndex - 1 + focusableItems.length) %
            focusableItems.length;
          focusableItems[prevIndex]?.focus();
        }
      }
    };

    document.addEventListener('keydown', this.keydownHandler);
  }

  private initializeTools() {
    let orderIndex = 0;
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

        this.tools.push({
          id,
          label,
          element,
          order: orderIndex++,
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
    // For menu buttons, prioritize the visible label text over title
    const buttonText = dom.querySelector('span')?.textContent?.trim();
    if (buttonText) return buttonText;

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

  private loadOrderState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const orderedIds = JSON.parse(saved) as string[];
        // Apply saved order to tools
        this.tools.forEach((tool) => {
          const savedIndex = orderedIds.indexOf(tool.id);
          if (savedIndex !== -1) {
            tool.order = savedIndex;
          } else {
            // New tools get placed at the end
            tool.order = orderedIds.length + tool.order;
          }
        });
        // Sort tools by their order
        this.tools.sort((a, b) => a.order - b.order);
      }
      // If no saved state, keep the default order from initialization
    } catch (e) {
      console.error('Failed to load order state:', e);
      // Keep default order on error
    }
  }

  private saveOrderState() {
    try {
      const orderedIds = this.tools.map((t) => t.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orderedIds));
    } catch (e) {
      console.error('Failed to save order state:', e);
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

  private showPinnedDropdown(tool: ToolItem, triggerElement: HTMLElement) {
    // Close overflow menu if open (ensure only one menu is open at a time)
    if (this.overflowMenu.style.display !== 'none') {
      this.overflowMenu.style.display = 'none';
      this.submenuStack = [];
      const overflowToggle = this.toolbar.querySelector(
        '.' + CSS_PREFIX + '__overflow-toggle',
      ) as HTMLElement;
      if (overflowToggle) {
        overflowToggle.setAttribute('aria-expanded', 'false');
      }
    }

    // Close any existing pinned dropdown
    if (this.pinnedDropdownMenu) {
      this.pinnedDropdownMenu.remove();
      this.pinnedDropdownMenu = null;
    }

    // Mark trigger as last focused for focus return on Escape
    this.toolbar.querySelectorAll('[data-last-focused]').forEach((el) => {
      el.removeAttribute('data-last-focused');
    });
    triggerElement.setAttribute('data-last-focused', 'true');

    const dropdown = tool.element as any;
    if (!dropdown.content) return;

    // Extract sub-items from dropdown
    const subItems: ToolItem[] = dropdown.content.map(
      (element: MenuElement, index: number) => {
        const { dom } = element.render(this.editorView);
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

    // Initialize stack with root menu
    this.pinnedDropdownStack = [{
      title: tool.label,
      tools: subItems,
      rootTool: tool,
    }];

    // Render the dropdown
    this.renderPinnedDropdown(triggerElement);
  }

  private pinnedDropdownGoBack() {
    // Remove last item from stack
    this.pinnedDropdownStack.pop();

    // If stack is empty, close the dropdown
    if (this.pinnedDropdownStack.length === 0) {
      if (this.pinnedDropdownMenu) {
        this.pinnedDropdownMenu.remove();
        this.pinnedDropdownMenu = null;
      }
      return;
    }

    // Re-render with previous menu
    const triggerElement = this.toolbar.querySelector(
      `[data-tool-id="${this.pinnedDropdownStack[0].rootTool.id}"]`,
    ) as HTMLElement;
    if (triggerElement) {
      this.renderPinnedDropdown(triggerElement);
    }
  }

  private pinnedDropdownShowSubmenu(
    tool: ToolItem,
    triggerElement: HTMLElement,
  ) {
    const dropdown = tool.element as any;
    if (!dropdown.content) return;

    // Extract sub-items
    const subItems: ToolItem[] = dropdown.content.map(
      (element: MenuElement, index: number) => {
        const { dom } = element.render(this.editorView);
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

    // Add to stack
    this.pinnedDropdownStack.push({
      title: tool.label,
      tools: subItems,
      rootTool: this.pinnedDropdownStack[0].rootTool,
    });

    // Re-render
    this.renderPinnedDropdown(triggerElement);
  }

  private renderPinnedDropdown(triggerElement: HTMLElement) {
    // Remove existing dropdown
    if (this.pinnedDropdownMenu) {
      this.pinnedDropdownMenu.remove();
    }

    const currentLevel =
      this.pinnedDropdownStack[this.pinnedDropdownStack.length - 1];
    const isSubmenu = this.pinnedDropdownStack.length > 1;

    // Create dropdown menu
    this.pinnedDropdownMenu = document.createElement('div');
    this.pinnedDropdownMenu.classList.add(CSS_PREFIX + '__pinned-dropdown');
    this.pinnedDropdownMenu.setAttribute('role', 'menu');
    this.pinnedDropdownMenu.setAttribute('aria-label', currentLevel.title);

    // Position it below the trigger element
    const rect = triggerElement.getBoundingClientRect();
    this.pinnedDropdownMenu.style.position = 'absolute';
    this.pinnedDropdownMenu.style.top = `${rect.bottom + 4}px`;
    this.pinnedDropdownMenu.style.left = `${rect.left}px`;
    this.pinnedDropdownMenu.style.zIndex = '1000';

    // Create scrollable content container
    const overflowContent = document.createElement('div');
    overflowContent.classList.add(CSS_PREFIX + '__overflow-content');

    // Add back button if in submenu
    if (isSubmenu) {
      const header = document.createElement('div');
      header.classList.add(CSS_PREFIX + '__overflow-submenu-header');

      const backButton = document.createElement('button');
      backButton.type = 'button';
      backButton.classList.add(CSS_PREFIX + '__overflow-back-button');
      backButton.setAttribute('aria-label', 'Go back to ' + currentLevel.title);
      backButton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 19l-7-7 7-7"/></svg>';
      backButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.pinnedDropdownGoBack();
      });

      const title = document.createElement('span');
      title.classList.add(CSS_PREFIX + '__overflow-submenu-title');
      title.textContent = currentLevel.title;

      header.appendChild(backButton);
      header.appendChild(title);
      overflowContent.appendChild(header);
    }

    // Render menu items
    currentLevel.tools.forEach((subTool) => {
      const isNestedDropdown = (subTool.element as any).content !== undefined;
      const wrapper = document.createElement('div');
      wrapper.classList.add(CSS_PREFIX + '__overflow-item');
      wrapper.setAttribute('data-tool-id', subTool.id);
      wrapper.setAttribute('role', 'menuitem');
      wrapper.setAttribute('tabindex', '0');

      if (isNestedDropdown) {
        // For nested dropdowns, show label and chevron
        const label = document.createElement('span');
        label.classList.add(CSS_PREFIX + '__overflow-item-label');
        label.textContent = subTool.label;
        wrapper.appendChild(label);

        const chevron = document.createElement('span');
        chevron.classList.add(CSS_PREFIX + '__overflow-item-chevron');
        chevron.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>';
        wrapper.appendChild(chevron);

        wrapper.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.pinnedDropdownShowSubmenu(subTool, triggerElement);
        });
      } else {
        // Regular menu item
        const { dom } = subTool.element.render(this.editorView);

        // Hide button's internal label
        const spans = dom.querySelectorAll('span');
        spans.forEach((span) => {
          const isInsideIcon = span.closest('.kb-icon') !== null;
          const isDirectChild = span.parentElement === dom;
          if (
            span.textContent && span.textContent.trim() &&
            !isInsideIcon &&
            isDirectChild &&
            !span.querySelector('svg') &&
            !span.classList.contains('kb-icon')
          ) {
            span.style.display = 'none';
          }
        });

        // Add label
        const label = document.createElement('span');
        label.classList.add(CSS_PREFIX + '__overflow-item-label');
        label.textContent = subTool.label;

        wrapper.appendChild(dom);
        wrapper.appendChild(label);

        // Make wrapper clickable
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

          // Close dropdown after click
          if (this.pinnedDropdownMenu) {
            this.pinnedDropdownMenu.remove();
            this.pinnedDropdownMenu = null;
            this.pinnedDropdownStack = [];
          }
        });
      }

      overflowContent.appendChild(wrapper);
    });

    // Add content to dropdown
    this.pinnedDropdownMenu.appendChild(overflowContent);

    // Add to document
    document.body.appendChild(this.pinnedDropdownMenu);

    // Close on click outside
    const doc = this.editorView.dom.ownerDocument || document;
    setTimeout(() => {
      if (this.closePinnedDropdownHandler) {
        doc.removeEventListener('click', this.closePinnedDropdownHandler);
      }
      this.closePinnedDropdownHandler = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          this.pinnedDropdownMenu &&
          !this.pinnedDropdownMenu.contains(target) &&
          !triggerElement.contains(target)
        ) {
          this.pinnedDropdownMenu.remove();
          this.pinnedDropdownMenu = null;
          this.pinnedDropdownStack = [];
          if (this.closePinnedDropdownHandler) {
            doc.removeEventListener('click', this.closePinnedDropdownHandler);
          }
        }
      };
      doc.addEventListener('click', this.closePinnedDropdownHandler);
    }, 0);
  }

  private renderOverflowMenu() {
    // Clear overflow menu
    this.overflowMenu.innerHTML = '';

    // Set ARIA attributes for overflow menu
    this.overflowMenu.setAttribute('role', 'menu');
    this.overflowMenu.setAttribute('aria-label', 'More tools');

    // Check if we're showing a submenu
    const isSubmenu = this.submenuStack.length > 0;
    const currentSubmenu = isSubmenu
      ? this.submenuStack[this.submenuStack.length - 1]
      : null;

    // Create scrollable content container - use grid layout for Google Docs style
    const overflowContent = document.createElement('div');
    overflowContent.classList.add(CSS_PREFIX + '__overflow-content');
    // Apply flex-wrap style for Google Docs-like icon layout
    if (!isSubmenu) {
      overflowContent.classList.add(CSS_PREFIX + '__overflow-content--grid');
    }

    if (isSubmenu && currentSubmenu) {
      // Render submenu header with back button
      const header = document.createElement('div');
      header.classList.add(CSS_PREFIX + '__overflow-submenu-header');

      const backButton = document.createElement('button');
      backButton.type = 'button';
      backButton.classList.add(CSS_PREFIX + '__overflow-back-button');
      backButton.setAttribute(
        'aria-label',
        'Go back to previous menu',
      );
      backButton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 19l-7-7 7-7"/></svg>';
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
        wrapper.setAttribute('role', 'menuitem');
        wrapper.setAttribute('tabindex', '0');

        if (isDropdown) {
          // For nested dropdowns, just show label and chevron (no icon/button)
          wrapper.setAttribute('aria-haspopup', 'true');
          // Add label
          const label = document.createElement('span');
          label.classList.add(CSS_PREFIX + '__overflow-item-label');
          label.textContent = tool.label;
          wrapper.appendChild(label);

          // Add chevron to indicate submenu
          const chevron = document.createElement('span');
          chevron.classList.add(CSS_PREFIX + '__overflow-item-chevron');
          chevron.setAttribute('aria-hidden', 'true');
          chevron.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>';
          wrapper.appendChild(chevron);

          // Click and keyboard handler for nested dropdown - navigate deeper
          const handleActivate = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            this.showSubmenu(tool);
          };
          wrapper.addEventListener('click', handleActivate);
          wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleActivate(e);
            }
          });
        } else {
          // Regular menu item
          const { dom, update } = tool.element.render(this.editorView);

          // Hide the button's internal label to avoid duplication
          const internalLabel = dom.querySelector('span');
          if (internalLabel) {
            internalLabel.style.display = 'none';
          }

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

          // Add keyboard support for Enter/Space
          wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
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
    } else {
      // Render main overflow menu - use the stored overflow tools from render()
      const allOverflowItems = this.currentOverflowTools;

      // Render all overflow tools as icon grid (Google Docs style)
      allOverflowItems.forEach((tool) => {
        // Skip tools with empty or invalid labels
        if (
          !tool.label || tool.label.trim() === '' ||
          tool.label === 'Unknown Tool'
        ) {
          return;
        }

        // Check if this is a dropdown with sub-items
        const isDropdown = (tool.element as any).content !== undefined;

        const wrapper = document.createElement('div');
        wrapper.classList.add(CSS_PREFIX + '__overflow-item');
        wrapper.classList.add(CSS_PREFIX + '__overflow-item--grid');
        wrapper.setAttribute('title', tool.label); // Tooltip on hover
        wrapper.setAttribute('role', 'menuitem');
        wrapper.setAttribute('tabindex', '0');
        wrapper.setAttribute('aria-label', tool.label);

        if (isDropdown) {
          // For dropdowns, create a custom button with dropdown indicator
          wrapper.classList.add(CSS_PREFIX + '__overflow-item--dropdown');
          wrapper.setAttribute('aria-haspopup', 'true');

          const button = document.createElement('button');
          button.type = 'button';
          button.classList.add('kb-menu__button');
          button.setAttribute('tabindex', '-1'); // Parent is focusable
          button.setAttribute('aria-hidden', 'true');

          // Add an icon (we'll use a document icon for Type menu)
          const icon = document.createElement('svg');
          icon.setAttribute('viewBox', '0 0 24 24');
          icon.setAttribute('fill', 'none');
          icon.setAttribute('stroke', 'currentColor');
          icon.setAttribute('stroke-width', '2');
          icon.setAttribute('aria-hidden', 'true');
          icon.innerHTML =
            '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>';
          button.appendChild(icon);

          wrapper.appendChild(button);

          // Add small dropdown indicator
          const indicator = document.createElement('span');
          indicator.classList.add(CSS_PREFIX + '__overflow-item-indicator');
          indicator.setAttribute('aria-hidden', 'true');
          indicator.innerHTML = '▼';
          wrapper.appendChild(indicator);

          // Click handler for dropdown - navigate to submenu
          wrapper.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showSubmenu(tool);
          });

          // Add keyboard support for Enter/Space
          wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              this.showSubmenu(tool);
            }
          });
        } else {
          // Regular menu item - show icon only with tooltip
          const { dom, update } = tool.element.render(this.editorView);

          // Hide any text labels, keep only icons
          const spans = dom.querySelectorAll('span');
          spans.forEach((span) => {
            const isInsideIcon = span.closest('.kb-icon') !== null;
            if (!isInsideIcon && !span.querySelector('svg')) {
              span.style.display = 'none';
            }
          });

          wrapper.appendChild(dom);

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

          // Add keyboard support for Enter/Space
          wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
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
  }

  private render() {
    // Skip render if currently dragging (to avoid interference)
    if (this.isDragging) return;

    // Clear toolbar and overflow menu
    this.toolbar.innerHTML = '';
    this.overflowMenu.innerHTML = '';

    // Get available width for toolbar items
    const toolbarWidth = this.toolbar.offsetWidth || this.wrapper.offsetWidth;
    const availableWidth = toolbarWidth - OVERFLOW_BUTTON_WIDTH - 16; // Reserve space for overflow button + padding

    // First pass: render all items to measure their widths
    const renderedItems: Array<{
      tool: ToolItem;
      wrapper: HTMLElement;
      width: number;
    }> = [];

    this.tools.forEach((tool) => {
      const wrapper = document.createElement('span');
      wrapper.classList.add(CSS_PREFIX + '__item');
      wrapper.setAttribute('data-tool-id', tool.id);
      wrapper.setAttribute('draggable', 'false');

      const isDropdown = (tool.element as any).content !== undefined;

      if (isDropdown) {
        const { dom } = tool.element.render(this.editorView);
        const dropdownMenu = dom.querySelector('.kb-dropdown__content');
        if (dropdownMenu) {
          (dropdownMenu as HTMLElement).style.display = 'none';
        }
        wrapper.appendChild(dom);
      } else {
        const { dom } = tool.element.render(this.editorView);
        wrapper.appendChild(dom);
      }

      // Temporarily add to toolbar to measure
      this.toolbar.appendChild(wrapper);
      const width = wrapper.getBoundingClientRect().width;
      renderedItems.push({ tool, wrapper, width });
    });

    // Second pass: determine which items fit
    let usedWidth = 0;
    const visibleItems: typeof renderedItems = [];
    const overflowItems: typeof renderedItems = [];

    for (const item of renderedItems) {
      if (usedWidth + item.width <= availableWidth) {
        visibleItems.push(item);
        usedWidth += item.width;
      } else {
        overflowItems.push(item);
      }
    }

    // Clear toolbar again and re-render only visible items
    this.toolbar.innerHTML = '';

    // Render visible tools in toolbar with proper event handlers
    visibleItems.forEach(({ tool, wrapper }) => {
      const isDropdown = (tool.element as any).content !== undefined;

      if (isDropdown) {
        const button = wrapper.querySelector('button') as
          | HTMLButtonElement
          | null;
        const label = wrapper.querySelector('.kb-dropdown__label') as
          | HTMLElement
          | null;

        const clickHandler = (e: Event) => {
          // Don't open dropdown if we were dragging
          if (this.isDragging) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.showPinnedDropdown(tool, wrapper);
        };

        // Mousedown handler - prevents built-in dropdown from opening
        // but allows our drag handler on the wrapper to work
        const mousedownHandler = (e: MouseEvent) => {
          // Stop the built-in dropdown's mousedown handler from firing
          // This prevents the double-menu issue
          e.stopImmediatePropagation();

          // If dragging, also stop propagation
          if (this.isDragging) {
            e.stopPropagation();
          }
          // Note: We don't call preventDefault() so the wrapper's
          // capture-phase drag handler can still work
        };

        if (button) {
          button.addEventListener('click', clickHandler, { capture: true });
          button.addEventListener('mousedown', mousedownHandler, {
            capture: true,
          });
        }
        if (label) {
          label.addEventListener('click', clickHandler, { capture: true });
          label.addEventListener('mousedown', mousedownHandler, {
            capture: true,
          });
        }
      }

      // Add drag-and-drop handlers
      this.setupDragHandlers(wrapper, tool);
      this.toolbar.appendChild(wrapper);
    });

    // Store overflow tools for the overflow menu
    this.currentOverflowTools = overflowItems.map((item) => item.tool);

    // Add separator before overflow button if there are overflow items
    if (this.currentOverflowTools.length > 0) {
      const separator = document.createElement('div');
      separator.classList.add(CSS_PREFIX + '__separator');
      this.toolbar.appendChild(separator);
    }

    // Add overflow toggle button if there are overflow items
    if (this.currentOverflowTools.length > 0) {
      const overflowToggle = document.createElement('button');
      overflowToggle.type = 'button';
      overflowToggle.className = CSS_PREFIX + '__overflow-toggle';
      overflowToggle.setAttribute('aria-haspopup', 'menu');
      overflowToggle.setAttribute('aria-expanded', 'false');
      overflowToggle.setAttribute('aria-label', 'More tools');
      overflowToggle.title = 'More tools';
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

        // Close any open pinned dropdown first (only one menu open at a time)
        if (this.pinnedDropdownMenu) {
          this.pinnedDropdownMenu.remove();
          this.pinnedDropdownMenu = null;
          this.pinnedDropdownStack = [];
        }

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

  private setupDragHandlers(wrapper: HTMLElement, tool: ToolItem) {
    let startX = 0;
    let startY = 0;

    const onMouseDown = (e: MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;

      startX = e.clientX;
      startY = e.clientY;

      // Start a timer for delayed drag initiation
      this.dragStartTimer = setTimeout(() => {
        this.startDrag(wrapper, tool, e);
      }, DRAG_START_DELAY);

      // Listen for mouse up to cancel if released early
      const onMouseUp = () => {
        if (this.dragStartTimer) {
          clearTimeout(this.dragStartTimer);
          this.dragStartTimer = null;
        }
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mousemove', onEarlyMove);
      };

      // If mouse moves too much before timer, cancel drag start
      const onEarlyMove = (moveEvent: MouseEvent) => {
        const dx = Math.abs(moveEvent.clientX - startX);
        const dy = Math.abs(moveEvent.clientY - startY);
        // Allow some tolerance for slight movement
        if (dx > 5 || dy > 5) {
          if (this.dragStartTimer) {
            clearTimeout(this.dragStartTimer);
            this.dragStartTimer = null;
          }
        }
      };

      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('mousemove', onEarlyMove);
    };

    // Use capture phase to ensure we get events from child elements (like dropdown buttons)
    wrapper.addEventListener('mousedown', onMouseDown, { capture: true });
  }

  private startDrag(wrapper: HTMLElement, tool: ToolItem, e: MouseEvent) {
    this.isDragging = true;
    this.draggedItem = tool;

    // Add dragging class to wrapper
    wrapper.classList.add(CSS_PREFIX + '__item--dragging');
    this.wrapper.classList.add(CSS_PREFIX + '__wrapper--dragging');

    // Create a ghost element for visual feedback
    const rect = wrapper.getBoundingClientRect();
    this.dragGhost = wrapper.cloneNode(true) as HTMLElement;
    this.dragGhost.classList.add(CSS_PREFIX + '__drag-ghost');
    this.dragGhost.style.position = 'fixed';
    this.dragGhost.style.left = `${rect.left}px`;
    this.dragGhost.style.top = `${rect.top}px`;
    this.dragGhost.style.width = `${rect.width}px`;
    this.dragGhost.style.height = `${rect.height}px`;
    this.dragGhost.style.pointerEvents = 'none';
    this.dragGhost.style.zIndex = '10000';
    document.body.appendChild(this.dragGhost);

    // Create a placeholder to show where the item will be dropped
    this.dragPlaceholder = document.createElement('span');
    this.dragPlaceholder.classList.add(CSS_PREFIX + '__drop-placeholder');

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.isDragging || !this.dragGhost) return;

      // Update ghost position
      const ghostRect = this.dragGhost.getBoundingClientRect();
      this.dragGhost.style.left = `${
        moveEvent.clientX - ghostRect.width / 2
      }px`;
      this.dragGhost.style.top = `${
        moveEvent.clientY - ghostRect.height / 2
      }px`;

      // Find the toolbar item we're hovering over
      const toolbarItems = Array.from(
        this.toolbar.querySelectorAll('.' + CSS_PREFIX + '__item'),
      ) as HTMLElement[];
      let insertBefore: HTMLElement | null = null;
      let insertIndex = -1;

      for (let i = 0; i < toolbarItems.length; i++) {
        const item = toolbarItems[i];
        if (item === wrapper) continue; // Skip the dragged item itself

        const itemRect = item.getBoundingClientRect();
        const itemCenter = itemRect.left + itemRect.width / 2;

        if (moveEvent.clientX < itemCenter && insertBefore === null) {
          insertBefore = item;
          insertIndex = i;
        }
      }

      // Remove existing placeholder
      if (this.dragPlaceholder && this.dragPlaceholder.parentNode) {
        this.dragPlaceholder.remove();
      }

      // Insert placeholder at the appropriate position
      if (insertBefore && this.dragPlaceholder) {
        insertBefore.parentNode?.insertBefore(
          this.dragPlaceholder,
          insertBefore,
        );
      } else if (this.dragPlaceholder) {
        // Insert at end (before separator or overflow toggle)
        const separator = this.toolbar.querySelector(
          '.' + CSS_PREFIX + '__separator',
        );
        if (separator) {
          separator.parentNode?.insertBefore(this.dragPlaceholder, separator);
        } else {
          const overflowToggle = this.toolbar.querySelector(
            '.' + CSS_PREFIX + '__overflow-toggle',
          );
          if (overflowToggle) {
            overflowToggle.parentNode?.insertBefore(
              this.dragPlaceholder,
              overflowToggle,
            );
          } else {
            this.toolbar.appendChild(this.dragPlaceholder);
          }
        }
      }
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      if (!this.isDragging) return;

      // Calculate new position based on placeholder
      if (this.dragPlaceholder && this.dragPlaceholder.parentNode) {
        const toolbarItems = Array.from(
          this.toolbar.querySelectorAll('.' + CSS_PREFIX + '__item'),
        );
        const placeholderIndex = Array.from(this.toolbar.children).indexOf(
          this.dragPlaceholder,
        );
        const draggedIndex = toolbarItems.indexOf(wrapper);

        // Calculate target index in visible items
        let visibleTargetIndex = 0;
        for (let i = 0; i < this.toolbar.children.length; i++) {
          const child = this.toolbar.children[i];
          if (child === this.dragPlaceholder) break;
          if (child.classList.contains(CSS_PREFIX + '__item')) {
            visibleTargetIndex++;
          }
        }

        // Find the tool's current index in the tools array
        const currentToolIndex = this.tools.indexOf(tool);

        if (
          currentToolIndex !== -1 && visibleTargetIndex !== currentToolIndex
        ) {
          // Remove the tool from its current position
          this.tools.splice(currentToolIndex, 1);

          // Insert at new position
          const insertAtIndex = visibleTargetIndex > currentToolIndex
            ? visibleTargetIndex - 1
            : visibleTargetIndex;
          this.tools.splice(insertAtIndex, 0, tool);

          // Update order values
          this.tools.forEach((t, i) => {
            t.order = i;
          });

          // Save to localStorage
          this.saveOrderState();
        }
      }

      // Clean up
      this.cleanupDrag(wrapper);

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Re-render after a short delay
      setTimeout(() => {
        this.render();
      }, 0);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private cleanupDrag(wrapper: HTMLElement) {
    this.isDragging = false;
    this.draggedItem = null;

    wrapper.classList.remove(CSS_PREFIX + '__item--dragging');
    this.wrapper.classList.remove(CSS_PREFIX + '__wrapper--dragging');

    if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }

    if (this.dragPlaceholder) {
      this.dragPlaceholder.remove();
      this.dragPlaceholder = null;
    }

    if (this.dragStartTimer) {
      clearTimeout(this.dragStartTimer);
      this.dragStartTimer = null;
    }
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

    if (this.closePinnedDropdownHandler) {
      doc.removeEventListener('click', this.closePinnedDropdownHandler);
      this.closePinnedDropdownHandler = null;
    }

    // Clean up keyboard handler
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    // Clean up ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clean up pinned dropdown
    if (this.pinnedDropdownMenu) {
      this.pinnedDropdownMenu.remove();
      this.pinnedDropdownMenu = null;
    }

    // Clean up drag state
    if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }
    if (this.dragPlaceholder) {
      this.dragPlaceholder.remove();
      this.dragPlaceholder = null;
    }
    if (this.dragStartTimer) {
      clearTimeout(this.dragStartTimer);
      this.dragStartTimer = null;
    }

    // Clean up DOM
    if (this.wrapper.parentNode) {
      this.wrapper.parentNode.replaceChild(this.editorView.dom, this.wrapper);
    }
  }
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
