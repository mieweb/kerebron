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
    width: 800,
    height: 900,
    path:
      'M0 75h800v125h-800z M0 825h800v-125h-800z M250 400h100v-100h100v100h100v100h-100v100h-100v-100h-100z',
  },
  lift: {
    width: 1024,
    height: 1024,
    path:
      'M219 310v329q0 7-5 12t-12 5q-8 0-13-5l-164-164q-5-5-5-13t5-13l164-164q5-5 13-5 7 0 12 5t5 12zM1024 749v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12zM1024 530v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 310v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 91v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12z',
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
    width: 805,
    height: 1024,
    path:
      'M317 869q42 18 80 18 214 0 214-191 0-65-23-102-15-25-35-42t-38-26-46-14-48-6-54-1q-41 0-57 5 0 30-0 90t-0 90q0 4-0 38t-0 55 2 47 6 38zM309 442q24 4 62 4 46 0 81-7t62-25 42-51 14-81q0-40-16-70t-45-46-61-24-70-8q-28 0-74 7 0 28 2 86t2 86q0 15-0 45t-0 45q0 26 0 39zM0 950l1-53q8-2 48-9t60-15q4-6 7-15t4-19 3-18 1-21 0-19v-37q0-561-12-585-2-4-12-8t-25-6-28-4-27-2-17-1l-2-47q56-1 194-6t213-5q13 0 39 0t38 0q40 0 78 7t73 24 61 40 42 59 16 78q0 29-9 54t-22 41-36 32-41 25-48 22q88 20 146 76t58 141q0 57-20 102t-53 74-78 48-93 27-100 8q-25 0-75-1t-75-1q-60 0-175 6t-132 6z',
  },
  em: {
    width: 585,
    height: 1024,
    path:
      'M0 949l9-48q3-1 46-12t63-21q16-20 23-57 0-4 35-165t65-310 29-169v-14q-13-7-31-10t-39-4-33-3l10-58q18 1 68 3t85 4 68 1q27 0 56-1t69-4 56-3q-2 22-10 50-17 5-58 16t-62 19q-4 10-8 24t-5 22-4 26-3 24q-15 84-50 239t-44 203q-1 5-7 33t-11 51-9 47-3 32l0 10q9 2 105 17-1 25-9 56-6 0-18 0t-18 0q-16 0-49-5t-49-5q-78-1-117-1-29 0-81 5t-69 6z',
  },
  underline: {
    width: 585,
    height: 1024,
    path: 'M0 908h1024v64H0Z',
  },
  code: {
    width: 896,
    height: 1024,
    path:
      'M608 192l-96 96 224 224-224 224 96 96 288-320-288-320zM288 192l-288 320 288 320 96-96-224-224 224-224-96-96z',
  },
  link: {
    width: 951,
    height: 1024,
    path:
      'M832 694q0-22-16-38l-118-118q-16-16-38-16-24 0-41 18 1 1 10 10t12 12 8 10 7 14 2 15q0 22-16 38t-38 16q-8 0-15-2t-14-7-10-8-12-12-10-10q-18 17-18 41 0 22 16 38l117 118q15 15 38 15 22 0 38-14l84-83q16-16 16-38zM430 292q0-22-16-38l-117-118q-16-16-38-16-22 0-38 15l-84 83q-16 16-16 38 0 22 16 38l118 118q15 15 38 15 24 0 41-17-1-1-10-10t-12-12-8-10-7-14-2-15q0-22 16-38t38-16q8 0 15 2t14 7 10 8 12 12 10 10q18-17 18-41zM941 694q0 68-48 116l-84 83q-47 47-116 47-69 0-116-48l-117-118q-47-47-47-116 0-70 50-119l-50-50q-49 50-118 50-68 0-116-48l-118-118q-48-48-48-116t48-116l84-83q47-47 116-47 69 0 116 48l117 118q47 47 47 116 0 70-50 119l50 50q49-50 118-50 68 0 116 48l118 118q48 48 48 116z',
  },
  bulletList: {
    width: 768,
    height: 896,
    path:
      'M0 512h128v-128h-128v128zM0 256h128v-128h-128v128zM0 768h128v-128h-128v128zM256 512h512v-128h-512v128zM256 256h512v-128h-512v128zM256 768h512v-128h-512v128z',
  },
  orderedList: {
    width: 768,
    height: 896,
    path:
      'M320 512h448v-128h-448v128zM320 768h448v-128h-448v128zM320 128v128h448v-128h-448zM79 384h78v-256h-36l-85 23v50l43-2v185zM189 590c0-36-12-78-96-78-33 0-64 6-83 16l1 66c21-10 42-15 67-15s32 11 32 28c0 26-30 58-110 112v50h192v-67l-91 2c49-30 87-66 87-113l1-1z',
  },
  taskList: {
    width: 24,
    height: 24,
    path:
      'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  },
  blockquote: {
    width: 640,
    height: 896,
    path:
      'M0 448v256h256v-256h-128c0 0 0-128 128-128v-128c0 0-256 0-256 256zM640 320v-128c0 0-256 0-256 256v256h256v-256h-128c0 0 0-128 128-128z',
  },
  insert: {
    width: 24,
    height: 24,
    path: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  },
  type: {
    width: 20,
    height: 22,
    path: 'M2.5 3v3h5.5v13h4V6H17.5V3H2.5z',
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
    width: 18,
    height: 23,
    path: 'M2.5 3v17h3v-7h7v7h3V3h-3v8h-7V3h-3z',
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
