import { EditorView } from 'prosemirror-view';
import { EditorState, Transaction } from 'prosemirror-state';

import { getIcon } from './icons.ts';

/// The types defined in this module aren't the only thing you can
/// display in your menu. Anything that conforms to this interface can
/// be put into a menu structure.
export interface MenuElement {
  /// Render the element for display in the menu. Must return a DOM
  /// element and a function that can be used to update the element to
  /// a new state. The `update` function must return false if the
  /// update hid the entire element.
  render(
    pm: EditorView,
  ): { dom: HTMLElement; update: (state: EditorState) => boolean };
}

/// An icon or label that, when clicked, executes a command.
export class MenuItem implements MenuElement {
  CSS_PREFIX = 'kb-menu__button';

  /// Create a menu item.
  constructor(
    /// The spec used to create this item.
    readonly spec: MenuItemSpec,
  ) {}

  /// Renders the icon according to its [display
  /// spec](#menu.MenuItemSpec.display), and adds an event handler which
  /// executes the command when the representation is clicked.
  render(view: EditorView) {
    let spec = this.spec;
    let dom = spec.render ? spec.render(view) : null;
    if (!dom) {
      // Create a proper button element for better accessibility
      dom = document.createElement('button');
      dom.setAttribute('type', 'button');

      // Add our new CSS classes while maintaining backward compatibility
      dom.classList.add(this.CSS_PREFIX);

      if (spec.icon) {
        const icon = getIcon(view.root, spec.icon);
        dom.appendChild(icon);
        dom.classList.add(this.CSS_PREFIX + '--icon-only');
      }

      if (spec.label) {
        const labelSpan = document.createElement('span');
        labelSpan.appendChild(
          document.createTextNode(translate(view, spec.label)),
        );
        dom.appendChild(labelSpan);
        if (spec.icon) {
          dom.classList.remove(this.CSS_PREFIX + '--icon-only');
        }
      }

      if (!spec.icon && !spec.label) {
        throw new RangeError('MenuItem without icon or label property');
      }
    }

    if (spec.title) {
      const title = typeof spec.title === 'function'
        ? spec.title(view.state)
        : spec.title;
      dom.setAttribute('title', translate(view, title));
      dom.setAttribute('aria-label', translate(view, title));
    }

    if (spec.class) dom.classList.add(spec.class);
    if (spec.css) dom.style.cssText += spec.css;

    dom.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (!dom!.classList.contains(this.CSS_PREFIX + '--disabled')) {
        spec.run(view.state, view.dispatch);
      }
    });

    const update = (state: EditorState) => {
      if (spec.select) {
        let selected = spec.select(state);
        dom!.style.display = selected ? '' : 'none';
        if (!selected) return false;
      }
      let enabled = true;
      if (spec.enable) {
        enabled = spec.enable(state) || false;
        setClass(dom!, this.CSS_PREFIX + '--disabled', !enabled);
        dom!.setAttribute('aria-disabled', (!enabled).toString());
      }
      if (spec.active) {
        let active = enabled && spec.active(state) || false;
        setClass(dom!, this.CSS_PREFIX + '--active', active);
        dom!.setAttribute('aria-pressed', active.toString());
      }
      return true;
    };

    return { dom, update };
  }
}

function translate(view: EditorView, text: string): string {
  return (view as any)._props.translate
    ? (view as any)._props.translate(text)
    : text;
}

/// Specifies an icon. May be either an SVG icon, in which case its
/// `path` property should be an [SVG path
/// spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d),
/// and `width` and `height` should provide the viewbox in which that
/// path exists. Alternatively, it may have a `text` property
/// specifying a string of text that makes up the icon, with an
/// optional `css` property giving additional CSS styling for the
/// text. _Or_ it may contain `dom` property containing a DOM node.
type PathSpec = string | { d: string; fill?: string };
export type IconSpec =
  | { path: string | PathSpec[]; width: number; height: number }
  | {
    text: string;
    css?: string;
  }
  | { dom: Node };

/// The configuration object passed to the `MenuItem` constructor.
export interface MenuItemSpec {
  /// The function to execute when the menu item is activated.
  run: (
    state: EditorState,
    dispatch: (tr: Transaction) => void,
  ) => boolean | Promise<boolean>;

  /// Optional function that is used to determine whether the item is
  /// appropriate at the moment. Deselected items will be hidden.
  select?: (state: EditorState) => boolean;

  /// Function that is used to determine if the item is enabled. If
  /// given and returning false, the item will be given a disabled
  /// styling.
  enable?: (state: EditorState) => boolean;

  /// A predicate function to determine whether the item is 'active' (for
  /// example, the item for toggling the strong mark might be active then
  /// the cursor is in strong text).
  active?: (state: EditorState) => boolean;

  /// A function that renders the item. You must provide either this,
  /// [`icon`](#menu.MenuItemSpec.icon), or [`label`](#MenuItemSpec.label).
  render?: (view: EditorView) => HTMLElement;

  /// Describes an icon to show for this item.
  icon?: IconSpec;

  /// Makes the item show up as a text label. Mostly useful for items
  /// wrapped in a [drop-down](#menu.Dropdown) or similar menu. The object
  /// should have a `label` property providing the text to display.
  label?: string;

  /// Defines DOM title (mouseover) text for the item.
  title?: string | ((state: EditorState) => string);

  /// Optionally adds a CSS class to the item's DOM representation.
  class?: string;

  /// Optionally adds a string of inline CSS to the item's DOM
  /// representation.
  css?: string;
}

let lastMenuEvent: { time: number; node: null | Node } = {
  time: 0,
  node: null,
};
function markMenuEvent(e: Event) {
  lastMenuEvent.time = Date.now();
  lastMenuEvent.node = e.target as Node;
}
function isMenuEvent(wrapper: HTMLElement) {
  return Date.now() - 100 < lastMenuEvent.time &&
    lastMenuEvent.node && wrapper.contains(lastMenuEvent.node);
}

/// A drop-down menu, displayed as a label with a downwards-pointing
/// triangle to the right of it.
export class Dropdown implements MenuElement {
  CSS_PREFIX = 'kb-dropdown';
  /// @internal
  content: readonly MenuElement[];

  /// Create a dropdown wrapping the elements.
  constructor(
    content: readonly MenuElement[] | MenuElement,
    /// @internal
    readonly options: {
      /// The label to show on the drop-down control.
      label?: string;

      /// Describes an icon to show for this dropdown.
      icon?: IconSpec;

      /// Sets the
      /// [`title`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
      /// attribute given to the menu control.
      title?: string;

      /// When given, adds an extra CSS class to the menu control.
      class?: string;

      /// When given, adds an extra set of CSS styles to the menu control.
      css?: string;
    } = {},
  ) {
    this.options = options || {};
    this.content = Array.isArray(content) ? content : [content];
  }

  /// Render the dropdown menu and sub-items.
  render(view: EditorView) {
    let content = renderDropdownItems(this.content, view);
    let win = view.dom.ownerDocument.defaultView;

    // Create a button element instead of div for better accessibility
    let label = document.createElement('button');
    label.setAttribute('type', 'button');
    label.classList.add(this.CSS_PREFIX + '__label');
    if (this.options.class) {
      label.classList.add(this.options.class);
    }
    if (this.options.css) label.setAttribute('style', this.options.css);

    // Add icon if specified
    if (this.options.icon) {
      const icon = getIcon(view.root, this.options.icon);
      label.appendChild(icon);
    }

    // Add text label (hidden by CSS in toolbar, visible in title/aria-label)
    const labelText = translate(view, this.options.label || '');
    if (labelText) {
      const textSpan = document.createElement('span');
      textSpan.classList.add(this.CSS_PREFIX + '__label-text');
      textSpan.textContent = labelText;
      label.appendChild(textSpan);
    }

    // Set title from explicit title option, or use label as fallback
    const titleText = this.options.title
      ? translate(view, this.options.title)
      : labelText;
    if (titleText) {
      label.setAttribute('title', titleText);
      label.setAttribute('aria-label', titleText);
    }

    // Set ARIA attributes for accessibility
    label.setAttribute('aria-haspopup', 'true');
    label.setAttribute('aria-expanded', 'false');

    let wrap = document.createElement('div');
    wrap.classList.add(this.CSS_PREFIX);
    wrap.appendChild(label);
    let open: { close: () => boolean; node: HTMLElement } | null = null;
    let listeningOnClose: (() => void) | null = null;
    let close = () => {
      if (open && open.close()) {
        open = null;
        win?.removeEventListener('mousedown', listeningOnClose!);
      }
    };
    label.addEventListener('mousedown', (e) => {
      e.preventDefault();
      markMenuEvent(e);
      if (open) {
        close();
        wrap.classList.remove('kb-dropdown--open');
      } else {
        open = this.expand(wrap, content.dom);
        wrap.classList.add('kb-dropdown--open');
        win?.addEventListener(
          'mousedown',
          listeningOnClose = () => {
            if (!isMenuEvent(wrap)) close();
          },
        );
      }
    });

    function update(state: EditorState) {
      let inner = content.update(state);
      wrap.style.display = inner ? '' : 'none';
      return inner;
    }

    return { dom: wrap, update };
  }

  /// @internal
  expand(dom: HTMLElement, items: readonly Node[]) {
    const menuDOM = document.createElement('div');
    menuDOM.classList.add('kb-dropdown__menu');
    menuDOM.setAttribute('role', 'menu');

    if (this.options.class) {
      menuDOM.classList.add(this.options.class);
    }
    items.forEach((item) => menuDOM.appendChild(item));
    let done = false;
    function close(): boolean {
      if (done) return false;
      done = true;
      dom.removeChild(menuDOM);
      return true;
    }
    dom.appendChild(menuDOM);
    return { close, node: menuDOM };
  }
}

function renderDropdownItems(items: readonly MenuElement[], view: EditorView) {
  let rendered = [], updates = [];
  for (let i = 0; i < items.length; i++) {
    let { dom, update } = items[i].render(view);
    const item = document.createElement('div');
    item.classList.add('kb-dropdown__item');
    item.appendChild(dom);
    rendered.push(item);
    updates.push(update);
  }
  return { dom: rendered, update: combineUpdates(updates, rendered) };
}

function combineUpdates(
  updates: readonly ((state: EditorState) => boolean)[],
  nodes: readonly HTMLElement[],
) {
  return (state: EditorState) => {
    let something = false;
    for (let i = 0; i < updates.length; i++) {
      let up = updates[i](state);
      nodes[i].style.display = up ? '' : 'none';
      if (up) something = true;
    }
    return something;
  };
}

/// Represents a submenu wrapping a group of elements that start
/// hidden and expand to the right when hovered over or tapped.
export class DropdownSubmenu implements MenuElement {
  /// @internal
  content: readonly MenuElement[];

  /// Creates a submenu for the given group of menu elements. The
  /// following options are recognized:
  constructor(
    content: readonly MenuElement[] | MenuElement,
    /// @internal
    readonly options: {
      /// The label to show on the submenu.
      label?: string;
    } = {},
  ) {
    this.content = Array.isArray(content) ? content : [content];
  }

  /// Renders the submenu.
  render(view: EditorView) {
    const CSS_PREFIX = 'kb-submenu';

    const items = renderDropdownItems(this.content, view);
    const win = view.dom.ownerDocument.defaultView;

    const wrap = document.createElement('div');
    wrap.classList.add(CSS_PREFIX);

    const label = document.createElement('div');
    label.classList.add(CSS_PREFIX + '__label');
    label.appendChild(
      document.createTextNode(translate(view, this.options.label || '')),
    );
    wrap.appendChild(label);

    const submenu = document.createElement('div');
    submenu.classList.add(CSS_PREFIX + '__content');
    items.dom.forEach((item) => submenu.appendChild(item));
    wrap.appendChild(submenu);

    let listeningOnClose: (() => void) | null = null;
    label.addEventListener('mousedown', (e) => {
      e.preventDefault();
      markMenuEvent(e);
      const isOpen = wrap.classList.contains(CSS_PREFIX + '--open');
      setClass(wrap, CSS_PREFIX + '--open', !isOpen);
      if (!isOpen && !listeningOnClose) {
        win?.addEventListener(
          'mousedown',
          listeningOnClose = () => {
            if (!isMenuEvent(wrap)) {
              wrap.classList.remove(CSS_PREFIX + '--open');
              win?.removeEventListener('mousedown', listeningOnClose!);
              listeningOnClose = null;
            }
          },
        );
      }
    });

    function update(state: EditorState) {
      let inner = items.update(state);
      wrap.style.display = inner ? '' : 'none';
      return inner;
    }
    return { dom: wrap, update };
  }
}

/// Render the given, possibly nested, array of menu elements into a
/// document fragment, placing separators between them (and ensuring no
/// superfluous separators appear when some of the groups turn out to
/// be empty).
export function renderGrouped(
  view: EditorView,
  content: readonly (readonly MenuElement[])[],
) {
  let result = document.createDocumentFragment();
  let updates: ((state: EditorState) => boolean)[] = [],
    separators: HTMLElement[] = [];
  for (let i = 0; i < content.length; i++) {
    let items = content[i], localUpdates = [], localNodes = [];
    for (let j = 0; j < items.length; j++) {
      let { dom, update } = items[j].render(view);
      let span = document.createElement('span');
      span.classList.add('kb-menu__item');
      span.appendChild(dom);
      result.appendChild(span);
      localNodes.push(span);
      localUpdates.push(update);
    }
    if (localUpdates.length) {
      updates.push(combineUpdates(localUpdates, localNodes));
      if (i < content.length - 1) {
        separators.push(result.appendChild(separator()));
      }
    }
  }

  function update(state: EditorState) {
    let something = false, needSep = false;
    for (let i = 0; i < updates.length; i++) {
      let hasContent = updates[i](state);
      if (i) {
        separators[i - 1].style.display = needSep && hasContent ? '' : 'none';
      }
      needSep = hasContent;
      if (hasContent) something = true;
    }
    return something;
  }
  return { dom: result, update };
}

function separator() {
  const elem = document.createElement('div');
  elem.classList.add('kb-menu__separator');
  return elem;
}

// Work around classList.toggle being broken in IE11
function setClass(dom: HTMLElement, cls: string, on: boolean) {
  if (on) dom.classList.add(cls);
  else dom.classList.remove(cls);
}
