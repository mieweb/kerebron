import { EditorView } from 'prosemirror-view';
import { EditorState, Plugin, Selection } from 'prosemirror-state';

import { MenuElement, renderGrouped } from './menu.ts';

const CSS_PREFIX = 'kb-menu';

function isIOS() {
  if (typeof navigator == 'undefined') return false;
  let agent = navigator?.userAgent;
  return !/Edge\/\d/.test(agent) && /AppleWebKit/.test(agent) &&
    /Mobile\/\w+/.test(agent);
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

  constructor(
    readonly editorView: EditorView,
    readonly options: Parameters<typeof MenuPlugin.constructor>[0],
  ) {
    this.root = editorView.root;
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add(CSS_PREFIX + '__wrapper');
    this.menu = document.createElement('div');
    this.menu.classList.add(CSS_PREFIX);
    this.wrapper.appendChild(this.menu);
    this.menu.className = CSS_PREFIX;

    if (editorView.dom.parentNode) {
      editorView.dom.parentNode.replaceChild(this.wrapper, editorView.dom);
    }
    this.wrapper.appendChild(editorView.dom);

    let { dom, update } = renderGrouped(this.editorView, this.options.content);
    this.contentUpdate = update;
    this.menu.appendChild(dom);
    this.update();

    if (options.floating && !isIOS()) {
      this.updateFloat();
      let potentialScrollers = getAllWrapping(this.wrapper);
      this.scrollHandler = (e: Event) => {
        let root = this.editorView.root;
        if (!((root as Document).body || root).contains(this.wrapper)) {
          potentialScrollers.forEach((el) =>
            el.removeEventListener('scroll', this.scrollHandler!)
          );
        } else {
          this.updateFloat(
            (e.target as HTMLElement).getBoundingClientRect
              ? e.target as HTMLElement
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
      let { dom, update } = renderGrouped(
        this.editorView,
        this.options.content,
      );
      this.contentUpdate = update;
      this.menu.replaceChild(dom, this.menu.firstChild!);
      this.root = this.editorView.root;
    }
    // this.contentUpdate(this.editorView.state);

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
    let selection = (this.editorView.root as Document).getSelection()!;
    if (!selection.focusNode) return;
    let rects = selection.getRangeAt(0).getClientRects();
    let selRect = rects[selectionIsInverted(selection) ? 0 : rects.length - 1];
    if (!selRect) return;
    let menuRect = this.menu.getBoundingClientRect();
    if (selRect.top < menuRect.bottom && selRect.bottom > menuRect.top) {
      let scrollable = findWrappingScrollable(this.wrapper);
      if (scrollable) scrollable.scrollTop -= menuRect.bottom - selRect.top;
    }
  }

  updateFloat(scrollAncestor?: HTMLElement) {
    let parent = this.wrapper,
      editorRect = parent.getBoundingClientRect(),
      top = scrollAncestor
        ? Math.max(0, scrollAncestor.getBoundingClientRect().top)
        : 0;

    if (this.floating) {
      if (
        editorRect.top >= top || editorRect.bottom < this.menu.offsetHeight + 10
      ) {
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
        let border = (parent.offsetWidth - parent.clientWidth) / 2;
        this.menu.style.left = (editorRect.left + border) + 'px';
        this.menu.style.display = editorRect.top >
            this.editorView.dom.ownerDocument.defaultView
              .innerHeight
          ? 'none'
          : '';
        if (scrollAncestor) this.menu.style.top = top + 'px';
      }
    } else {
      if (
        editorRect.top < top && editorRect.bottom >= this.menu.offsetHeight + 10
      ) {
        this.floating = true;
        let menuRect = this.menu.getBoundingClientRect();
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
    if (this.wrapper.parentNode) {
      this.wrapper.parentNode.replaceChild(this.editorView.dom, this.wrapper);
    }
  }
}

// Not precise, but close enough
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
  let res: (Node | Window)[] = [node.ownerDocument!.defaultView];
  for (let cur = node.parentNode; cur; cur = cur.parentNode) {
    res.push(cur);
  }
  return res;
}

export class MenuPlugin extends Plugin {
  constructor(options: {
    /// Provides the content of the menu, as a nested array to be
    /// passed to `renderGrouped`.
    content: readonly (readonly MenuElement[])[];

    /// Determines whether the menu floats, i.e. whether it sticks to
    /// the top of the viewport when the editor is partially scrolled
    /// out of view.
    floating?: boolean;
  }) {
    super({
      view(editorView) {
        return new MenuBarView(editorView, options);
      },
    });
  }
}
