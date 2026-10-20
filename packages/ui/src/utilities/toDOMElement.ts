import { DOMOutputSpec } from 'prosemirror-model';

export function toDOMElement(spec: DOMOutputSpec | string): Node {
  if (typeof spec === 'string') {
    if (spec.startsWith('&#')) {
      const match = spec.match(/^&#(?:x([0-9a-f]+)|([0-9]+));?$/i);
      if (match) {
        const codePoint = parseInt(match[1] || match[2], match[1] ? 16 : 10);
        return document.createTextNode(
          String.fromCodePoint(codePoint),
        );
      }
    }
    return document.createTextNode(spec);
  }

  if (spec instanceof Element) {
    return spec;
  }

  if (!Array.isArray(spec)) {
    throw new Error('Invalid DOM spec');
  }

  const [tag, maybeAttrs, ...children] = spec;

  const hasAttrs = maybeAttrs &&
    typeof maybeAttrs === 'object' &&
    !Array.isArray(maybeAttrs);

  const attrs = hasAttrs ? maybeAttrs : {};
  const childSpecs = hasAttrs ? children : [maybeAttrs, ...children];

  if (attrs['data-anchor']) {
    // TODO make it dynamic CSS class when available (see ui.css)
    let style = attrs['style'] || '';
    if (style) style += '; ';
    style += 'anchor-name: ' + attrs['data-anchor'];
    attrs['style'] = style;
  }

  try {
    const el = document.createElement(tag);

    for (const [name, value] of Object.entries(attrs)) {
      if (value != null) {
        el.setAttribute(name, String(value));
      }
    }

    for (const child of childSpecs) {
      if (child == null) continue;
      el.appendChild(toDOMElement(child));
    }

    return el;
  } catch (err: any) {
    if ('message' in err && err.message.indexOf('Invalid element name') > -1) {
      console.error('Error with tag:', tag);
    }
    throw err;
  }
}
