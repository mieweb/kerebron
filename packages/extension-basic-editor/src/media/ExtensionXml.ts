import { Node as PMNode, NodeSpec, Schema } from 'prosemirror-model';

import { type Converter, type CoreEditor, Extension } from '@kerebron/editor';

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function jsonToXml(node: string | PMNode) {
  if (typeof node === 'string') {
    return escapeXml(node);
  }

  const attrs = [];

  if (node.attrs) {
    for (const [k, v] of Object.entries(node.attrs)) {
      attrs.push(`${k}="${escapeXml(String(v))}"`);
    }
  }

  const attrString = attrs.length ? ' ' + attrs.join(' ') : '';

  let xml = `<${node.type}${attrString}>`;

  if (node.text) {
    xml += escapeXml(node.text);
  }

  if (node.marks) {
    for (const mark of node.marks) {
      xml += `<mark type="${mark.type}" />`;
    }
  }

  if (node.content) {
    for (const child of node.content) {
      xml += jsonToXml(child);
    }
  }

  xml += `</${node.type}>`;

  return xml;
}

function xmlToJson(element: HTMLElement) {
  const obj: NodeSpec = {
    type: element.tagName,
  };

  if (element.attributes.length) {
    obj.attrs = {};
    for (const attr of element.attributes) {
      obj.attrs[attr.name] = attr.value;
    }
  }

  const content = [];

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) {
        content.push({
          type: 'text',
          text,
        });
      }
    } else if (child.tagName === 'mark') {
      // handle marks separately
    } else {
      content.push(xmlToJson(child));
    }
  }

  if (content.length) {
    obj.content = content;
  }

  return obj;
}

export class ExtensionXml extends Extension {
  name = 'xml';

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    return {
      'text/html': {
        fromDoc: async (document: PMNode): Promise<Uint8Array> => {
          const json = document.toJSON();
          const xml = jsonToXml(json);
          return new TextEncoder().encode(xml);
        },
        toDoc: async (buffer: Uint8Array): Promise<PMNode> => {
          const xml = new TextDecoder().decode(buffer);
          const doc = new globalThis.DOMParser().parseFromString(
            xml,
            'text/xml',
          );
          const json = xmlToJson(doc.documentElement);
          return PMNode.fromJSON(schema, json);
        },
      },
    };
  }
}
