import { IconSpec } from './menu.ts';

const SVG = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';

const prefix = 'kb-icon';

function hashPath(path: string) {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    hash = (((hash << 5) - hash) + path.charCodeAt(i)) | 0;
  }
  return hash;
}

export function getIcon(
  root: Document | ShadowRoot,
  icon: { path: string; width: number; height: number } | {
    text: string;
    css?: string;
  } | { dom: Node },
): HTMLElement {
  let doc = (root.nodeType == 9 ? root as Document : root.ownerDocument) ||
    document;
  let node = doc.createElement('div');
  node.className = prefix;
  if ((icon as any).path) {
    let { path, width, height } = icon as {
      path: string;
      width: number;
      height: number;
    };
    let name = 'pm-icon-' + hashPath(path).toString(16);
    if (!doc.getElementById(name)) {
      buildSVG(
        root,
        name,
        icon as { path: string; width: number; height: number },
      );
    }
    let svg = node.appendChild(doc.createElementNS(SVG, 'svg'));
    svg.style.width = (width / height) + 'em';
    let use = svg.appendChild(doc.createElementNS(SVG, 'use'));
    use.setAttributeNS(
      XLINK,
      'href',
      /([^#]*)/.exec(doc.location.toString())![1] + '#' + name,
    );
  } else if ((icon as any).dom) {
    node.appendChild((icon as any).dom.cloneNode(true));
  } else {
    let { text, css } = icon as { text: string; css?: string };
    node.appendChild(doc.createElement('span')).textContent = text || '';
    if (css) (node.firstChild as HTMLElement).style.cssText = css;
  }
  return node;
}

function buildSVG(
  root: Document | ShadowRoot,
  name: string,
  data: { width: number; height: number; path: string },
) {
  let [doc, top] = root.nodeType == 9
    ? [root as Document, (root as Document).body]
    : [root.ownerDocument || document, root];
  let collection = doc.getElementById(prefix + '-collection') as Element;
  if (!collection) {
    collection = doc.createElementNS(SVG, 'svg');
    collection.id = prefix + '-collection';
    (collection as HTMLElement).style.display = 'none';
    top.insertBefore(collection, top.firstChild);
  }
  let sym = doc.createElementNS(SVG, 'symbol');
  sym.id = name;
  sym.setAttribute('viewBox', '0 0 ' + data.width + ' ' + data.height);
  let path = sym.appendChild(doc.createElementNS(SVG, 'path'));
  path.setAttribute('d', data.path);
  collection.appendChild(sym);
}

/// A set of basic editor-related icons. Contains the properties
/// `join`, `lift`, `selectParentNode`, `undo`, `redo`, `strong`, `em`,
/// `code`, `link`, `bulletList`, `orderedList`, and `blockquote`, each
/// holding an object that can be used as the `icon` option to
/// `MenuItem`.
export const icons: { [name: string]: IconSpec } = {
  join: {
    width: 24,
    height: 24,
    path:
      'M16 13h-3V3h-2v10H8l4 4 4-4zM4 19v2h16v-2H4z',
  },
  lift: {
    width: 24,
    height: 24,
    path:
      'M11 4H3v2h8V4zm0 4H3v2h8V8zm0 4H3v2h8v-2zm3-3l-3 3 3 3v-2h4v-2h-4V9zm6 6H11v2h9v-2z',
  },
  selectParentNode: {
    width: 24,
    height: 24,
    path:
      'M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2z',
  },
  undo: {
    width: 24,
    height: 24,
    path:
      'M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
  },
  redo: {
    width: 24,
    height: 24,
    path:
      'M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z',
  },
  strong: {
    width: 24,
    height: 24,
    path:
      'M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z',
  },
  em: {
    width: 24,
    height: 24,
    path:
      'M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z',
  },
  underline: {
    width: 24,
    height: 24,
    path:
      'M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z',
  },
  code: {
    width: 24,
    height: 24,
    path:
      'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  },
  link: {
    width: 24,
    height: 24,
    path:
      'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  },
  bulletList: {
    width: 24,
    height: 24,
    path:
      'M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z',
  },
  orderedList: {
    width: 24,
    height: 24,
    path:
      'M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z',
  },
  taskList: {
    width: 24,
    height: 24,
    path:
      'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  },
  blockquote: {
    width: 24,
    height: 24,
    path:
      'M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z',
  },
  insert: {
    width: 24,
    height: 24,
    path: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  },
  type: {
    width: 24,
    height: 24,
    path: 'M5 4v3h5.5v12h3V7H19V4H5z',
  },
  table: {
    width: 24,
    height: 24,
    path:
      'M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z',
  },
  image: {
    width: 24,
    height: 24,
    path:
      'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  },
  horizontalRule: {
    width: 24,
    height: 24,
    path: 'M4 11h16v2H4z',
  },
  heading: {
    width: 24,
    height: 24,
    path: 'M6 4v16h2v-7h8v7h2V4h-2v7H8V4H6z',
  },
  strike: {
    width: 24,
    height: 24,
    path: 'M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z',
  },
  highlight: {
    width: 24,
    height: 24,
    path:
      'M17.75 7L14 3.25l-10 10V17h3.75l10-10zm2.96-2.96a.996.996 0 0 0 0-1.41L18.37.29a.996.996 0 0 0-1.41 0L15 2.25 18.75 6l1.96-1.96zM2 20h20v4H2z',
  },
  indent: {
    width: 24,
    height: 24,
    path:
      'M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z',
  },
  outdent: {
    width: 24,
    height: 24,
    path:
      'M3 21h18v-2H3v2zM7 8v8l-4-4 4-4zm4 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z',
  },
  superscript: {
    width: 24,
    height: 24,
    path:
      'M22 7h-2v1h3v1h-4V7c0-.55.45-1 1-1h2V5h-3V4h3c.55 0 1 .45 1 1v1c0 .55-.45 1-1 1zM5.88 20h2.66l3.4-5.42h.12l3.4 5.42h2.66l-4.65-7.27L17.81 6h-2.68l-3.07 4.99h-.12L8.87 6H6.19l4.32 6.73L5.88 20z',
  },
  subscript: {
    width: 24,
    height: 24,
    path:
      'M22 18h-2v1h3v1h-4v-2c0-.55.45-1 1-1h2v-1h-3v-1h3c.55 0 1 .45 1 1v1c0 .55-.45 1-1 1zM5.88 18h2.66l3.4-5.42h.12l3.4 5.42h2.66l-4.65-7.27L17.81 4h-2.68l-3.07 4.99h-.12L8.87 4H6.19l4.32 6.73L5.88 18z',
  },
  alignLeft: {
    width: 24,
    height: 24,
    path:
      'M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z',
  },
  alignCenter: {
    width: 24,
    height: 24,
    path:
      'M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z',
  },
  alignRight: {
    width: 24,
    height: 24,
    path:
      'M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z',
  },
  alignJustify: {
    width: 24,
    height: 24,
    path:
      'M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z',
  },
};
