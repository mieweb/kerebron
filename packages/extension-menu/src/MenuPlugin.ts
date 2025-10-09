import { EditorView } from 'prosemirror-view';
import { EditorState, Plugin, Selection } from 'prosemirror-state';

import { MenuElement, renderGrouped } from './menu.ts';

const CSS_PREFIX = 'kb-menu';

function isIOS() {
  if (typeof navigator == 'undefined') return false;
  const agent = navigator?.userAgent;
  return !/Edge\/\d/.test(agent) && /AppleWebKit/.test(agent) && /Mobile\/\w+/.test(agent);
}

function isMobileView() {
  if (typeof window == 'undefined') return false;
  return window.innerWidth <= 767;
}

function selectionIsInverted(selection: Selection) {
  if (selection.anchorNode == selection.focusNode) {
    return selection.anchorOffset > selection.focusOffset;
  }
  return selection.anchorNode!.compareDocumentPosition(selection.focusNode!) ==
    Node.DOCUMENT_POSITION_FOLLOWING;
}

function findWrappingScrollable(node: Node) {
  for (let cur = node.parentNode; cur; cur = cur.parentNode) {
    if ((cur as HTMLElement).scrollHeight > (cur as HTMLElement).clientHeight) {
      return cur as HTMLElement;
    }
  }
}

function getAllWrapping(node: Node) {
  const res: (Node | Window)[] = [node.ownerDocument!.defaultView];
  for (let cur = node.parentNode; cur; cur = cur.parentNode) res.push(cur);
  return res;
}

export interface MenuPluginOptions {
  /// Provides the content of the menu, as a nested array to be passed to `renderGrouped`.
  content: readonly (readonly MenuElement[])[];

  /// Determines whether the menu floats (sticks to viewport top when the editor scrolls).
  floating?: boolean;
}

class MenuBarView {
  wrapper: HTMLElement;
  menu: HTMLElement;
  spacer: HTMLElement | null = null;
  maxHeight = 0;
  widthForMaxHeight = 0;
  floating = false;
  contentUpdate: (state: EditorState) => boolean;
  scrollHandler: ((event: Event) => void) | null = null;
  root: Document | ShadowRoot;

  // Overflow + layout
  private contentHost!: HTMLElement;
  private overflowToggle!: HTMLButtonElement;
  private overflowRow!: HTMLElement;
  private originalOrder: HTMLElement[] = [];
  private ro!: ResizeObserver;

  constructor(
    readonly editorView: EditorView,
    readonly options: MenuPluginOptions,
  ) {
    this.root = editorView.root;

    // Wrapper and toolbar shell
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add(CSS_PREFIX + '__wrapper');

    this.menu = document.createElement('div');
    this.menu.classList.add(CSS_PREFIX);
    this.menu.setAttribute('role', 'toolbar');
    (this.menu.style as any).containerType = 'inline-size';

    // Mount toolbar before the editor DOM
    this.wrapper.appendChild(this.menu);
    if (editorView.dom.parentNode) {
      editorView.dom.parentNode.replaceChild(this.wrapper, editorView.dom);
    }
    this.wrapper.appendChild(editorView.dom);

    // Host for the existing menu content
    this.contentHost = document.createElement('div');
    this.contentHost.classList.add(CSS_PREFIX + '__content');
    this.menu.appendChild(this.contentHost);

    // Render grouped items into host
    const { dom, update } = renderGrouped(this.editorView, this.options.content);
    this.contentUpdate = update;
    this.contentHost.appendChild(dom);

    // 3-dot overflow toggle
    this.overflowToggle = document.createElement('button');
    this.overflowToggle.type = 'button';
    this.overflowToggle.className = 'kb-menu__button kb-overflow-toggle';
    this.overflowToggle.setAttribute('aria-haspopup', 'true');
    this.overflowToggle.setAttribute('aria-expanded', 'false');
    this.overflowToggle.title = 'More';
    this.overflowToggle.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
    this.menu.appendChild(this.overflowToggle);

    // Second row that holds overflowed actions (below by default)
    this.overflowRow = document.createElement('div');
    this.overflowRow.className = 'kb-menu__overflow-row';
    this.wrapper.insertBefore(this.overflowRow, editorView.dom);

    // Toggle second row open/closed
    this.overflowToggle.addEventListener('click', () => {
      const open = !this.wrapper.classList.contains('kb-menu--overflow-open');
      this.wrapper.classList.toggle('kb-menu--overflow-open', open);
      this.overflowToggle.setAttribute('aria-expanded', String(open));
    });

    // Remember original order for stable restore on widen
    this.originalOrder = Array.from(this.contentHost.children) as HTMLElement[];

    // Tag pinned items (works even for icon-only)
    this.autotagPinned();

    // Initial render/layout
    this.update();
    this.relayout();
    this.updateMobileClass();

    // React to width changes of the toolbar area
    this.ro = new ResizeObserver(() => {
      this.relayout();
      this.updateMobileClass();
    });
    this.ro.observe(this.wrapper);

    // Existing floating behavior
    if (this.options.floating && !isIOS()) {
      this.updateFloat();
      const potentialScrollers = getAllWrapping(this.wrapper);
      this.scrollHandler = (e: Event) => {
        const root = this.editorView.root;
        if (!((root as Document).body || root).contains(this.wrapper)) {
          potentialScrollers.forEach((el) =>
            el.removeEventListener('scroll', this.scrollHandler!)
          );
        } else {
          this.updateFloat(
            (e.target as HTMLElement).getBoundingClientRect
              ? (e.target as HTMLElement)
              : undefined,
          );
        }
      };
      potentialScrollers.forEach((el) =>
        el.addEventListener('scroll', this.scrollHandler!)
      );
    }
  }

  update() {
    if (this.editorView.root != this.root) {
      const { dom, update } = renderGrouped(this.editorView, this.options.content);
      this.contentUpdate = update;
      // Replace ONLY the content host contents, not the overflow toggle
      this.contentHost.replaceChildren(dom);
      this.root = this.editorView.root;
      // Re-tag pinned after re-render (e.g., schema changes)
      this.autotagPinned();
      // Recompute order snapshot
      this.originalOrder = Array.from(this.contentHost.children) as HTMLElement[];
      this.relayout();
    }

    // Keep original height caching logic (only used in non-floating layout)
    if (this.floating) {
      this.updateScrollCursor();
    } else {
      if (this.menu.offsetWidth != this.widthForMaxHeight) {
        this.widthForMaxHeight = this.menu.offsetWidth;
        this.maxHeight = 0;
      }
      if (this.menu.offsetHeight > this.maxHeight) {
        this.maxHeight = this.menu.offsetHeight;
      }
    }
  }

  updateScrollCursor() {
    const selection = (this.editorView.root as Document).getSelection()!;
    if (!selection?.focusNode) return;
    const rects = selection.getRangeAt(0).getClientRects();
    const selRect = rects[selectionIsInverted(selection) ? 0 : rects.length - 1];
    if (!selRect) return;
    const menuRect = this.menu.getBoundingClientRect();
    if (selRect.top < menuRect.bottom && selRect.bottom > menuRect.top) {
      const scrollable = findWrappingScrollable(this.wrapper);
      if (scrollable) (scrollable as HTMLElement).scrollTop -= menuRect.bottom - selRect.top;
    }
  }

  updateFloat(scrollAncestor?: HTMLElement) {
    const parent = this.wrapper;
    const editorRect = parent.getBoundingClientRect();
    const top = scrollAncestor
      ? Math.max(0, scrollAncestor.getBoundingClientRect().top)
      : 0;

    if (this.floating) {
      if (editorRect.top >= top || editorRect.bottom < this.menu.offsetHeight + 10) {
        this.floating = false;
        this.menu.style.position =
          this.menu.style.left =
          this.menu.style.top =
          this.menu.style.width =
          '';
        this.menu.style.display = '';
        this.spacer!.parentNode!.removeChild(this.spacer!);
        this.spacer = null;
      } else {
        const border = (parent.offsetWidth - parent.clientWidth) / 2;
        this.menu.style.left = (editorRect.left + border) + 'px';
        this.menu.style.display =
          editorRect.top > this.editorView.dom.ownerDocument.defaultView!.innerHeight
            ? 'none'
            : '';
        if (scrollAncestor) this.menu.style.top = top + 'px';
      }
    } else {
      if (editorRect.top < top && editorRect.bottom >= this.menu.offsetHeight + 10) {
        this.floating = true;
        const menuRect = this.menu.getBoundingClientRect();
        this.menu.style.left = menuRect.left + 'px';
        this.menu.style.width = menuRect.width + 'px';
        if (scrollAncestor) this.menu.style.top = top + 'px';
        this.menu.style.position = 'fixed';
        this.spacer = document.createElement('div');
        this.spacer.classList.add(CSS_PREFIX + '__spacer');
        this.spacer.style.height = `${menuRect.height}px`;
        parent.insertBefore(this.spacer, this.menu);
      }
    }
  }

  destroy() {
    if (this.ro) this.ro.disconnect();
    if (this.scrollHandler) {
      const potentialScrollers = getAllWrapping(this.wrapper);
      potentialScrollers.forEach((el) =>
        el.removeEventListener('scroll', this.scrollHandler!)
      );
    }
    if (this.wrapper.parentNode) {
      this.wrapper.parentNode.replaceChild(this.editorView.dom, this.wrapper);
    }
  }

  // ---------- Overflow logic ----------

  // Tag items that must always stay visible (works with icon-only buttons).
  private autotagPinned() {
    const items = this.contentHost.querySelectorAll('.kb-menu__item');

    items.forEach((item) => {
      const btn = item.querySelector('.kb-menu__button') as HTMLElement | null;
      const dd  = item.querySelector('.kb-dropdown__label') as HTMLElement | null;

      const a11y = (
        btn?.getAttribute('aria-label') ||
        btn?.getAttribute('title') ||
        dd?.textContent ||
        ''
      ).trim().toLowerCase();

      const isPinnedByText =
        /\b(undo|redo|bold|strong|table)\b/.test(a11y) ||
        /(bullet|bulleted\s*list)/.test(a11y) ||
        a11y === 'file';

      if (isPinnedByText) {
        (item as HTMLElement).classList.add('kb-pin');
        return;
      }

      // Heuristics for icon-only cases
      const svg = item.querySelector('svg');
      const svgTitle = svg?.querySelector('title')?.textContent?.toLowerCase() || '';
      const hint = `${svg?.getAttribute('class') || ''} ${svg?.getAttribute('id') || ''}`.toLowerCase();
      if (/(undo|redo|bold|strong|table|bullet)/.test(svgTitle) || /(undo|redo|bold|strong|table|list|bul)/.test(hint)) {
        (item as HTMLElement).classList.add('kb-pin');
      }
    });
  }

  // Recompute layout on width changes
  private relayout() {
    // Use wrapper width for stability (includes padding)
    const narrow = this.wrapper.clientWidth <= 900;

    // 1) Reset: move everything back to main row in original order
    for (const node of this.originalOrder) {
      if (node.parentElement !== this.contentHost) {
        this.contentHost.appendChild(node);
      }
    }

    // Helper: tidy separators (hide double/leading/trailing)
    const cleanupSeparators = (parent: HTMLElement) => {
      const kids = Array.from(parent.children) as HTMLElement[];
      let lastWasSep = true; // treat start as separator, hide leading
      for (const k of kids) {
        const isSep = k.classList.contains('kb-menu__separator');
        if (isSep && lastWasSep) {
          k.style.display = 'none';
        } else if (isSep) {
          k.style.display = '';
        } else {
          k.style.display = '';
        }
        lastWasSep = isSep;
      }
      // hide trailing separator
      for (let i = kids.length - 1; i >= 0; i--) {
        if (kids[i].classList.contains('kb-menu__separator')) {
          kids[i].style.display = 'none';
        } else {
          break;
        }
      }
    };

    if (narrow) {
      // 2) Move all NON-pinned into overflow row (preserving order)
      const items = Array.from(this.contentHost.children) as HTMLElement[];
      for (const node of items) {
        if (!this.isPinned(node)) {
          this.overflowRow.appendChild(node);
        }
      }

      // 3) Clean separators in both rows
      cleanupSeparators(this.contentHost);
      cleanupSeparators(this.overflowRow);

      // 4) Toggle classes and 3-dot visibility
      const hasOverflow = this.overflowRow.children.length > 0;
      this.wrapper.classList.add('kb-menu--narrow');
      this.overflowToggle.style.display = hasOverflow ? '' : 'none';
    } else {
      // Wide again: already restored above
      this.wrapper.classList.remove('kb-menu--narrow', 'kb-menu--overflow-open');
      this.overflowToggle.setAttribute('aria-expanded', 'false');
      this.overflowToggle.style.display = 'none';
      cleanupSeparators(this.contentHost);
    }
  }

  // Add/remove mobile class based on viewport width
  private updateMobileClass() {
    const mobile = isMobileView();
    this.wrapper.classList.toggle('kb-menu--mobile', mobile);
  }

  // Item is pinned if marked, or by fallback rules
  private isPinned(node: HTMLElement): boolean {
    if (node.classList.contains('kb-pin')) return true;

    if (node.classList.contains('kb-menu__separator')) {
      const prev = node.previousElementSibling as HTMLElement | null;
      const next = node.nextElementSibling as HTMLElement | null;
      return !!(prev && next && this.isPinned(prev) && this.isPinned(next));
    }

    // Fallback to attributes
    const btn = node.querySelector('.kb-menu__button') as HTMLElement | null;
    if (btn) {
      const key = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '')
        .trim()
        .toLowerCase();
      if (
        key === 'undo' ||
        key === 'redo' ||
        key === 'bold' ||
        key === 'table' ||
        key.includes('bullet') ||
        key === 'file'
      ) return true;
    }

    const ddLabel = node.querySelector('.kb-dropdown__label') as HTMLElement | null;
    if (ddLabel) {
      const text = (ddLabel.textContent || '').trim().toLowerCase();
      if (text === 'file' || text === 'table') return true;
    }
    return false;
  }
}

export class MenuPlugin extends Plugin {
  constructor(options: MenuPluginOptions) {
    super({
      view(editorView) {
        return new MenuBarView(editorView, options);
      },
    });
  }
}
