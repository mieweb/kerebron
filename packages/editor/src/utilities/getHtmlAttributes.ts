export function getHtmlAttributes(extension, node) {
  const attrs = {};

  if (extension.attributes) {
    for (const [key, value] of Object.entries(extension.attributes)) {
      if ('undefined' !== typeof node.attrs[key]) {
        attrs[key] = node.attrs[key];
      } else {
        if (value.toDom) {
          attrs[key] = value.toDom(node);
        } else {
          attrs[key] = value.default;
        }
      }
    }
  }

  return attrs;
}

export function setHtmlAttributes(extension, element) {
  const attrs = {};

  if (extension.attributes) {
    for (const [key, value] of Object.entries(extension.attributes)) {
      if (value.fromDom) {
        attrs[key] = value.fromDom(element);
      } else {
        attrs[key] = value.default;
      }
    }
  }

  return attrs;
}

export function addAttributesToSchema(spec, extension) {
  const attrs = {};

  if (extension.attributes) {
    if (!spec.attrs) {
      spec.attrs = {};
    }
    for (const [key, value] of Object.entries(extension.attributes)) {
      spec.attrs[key] = value;
      if (!value.toDom) {
        value.toDom = (node) => node.attrs[key];
      }
    }
  }
}
