// import { DOMParser } from 'jsr:@b-fuze/deno-dom'; // No xml support (mathML) https://github.com/b-fuze/deno-dom/issues?q=is%3Aissue%20state%3Aopen%20xml
import { DOMParser } from 'linkedom';
import { XMLSerializer } from '@xmldom/xmldom';
import * as xpath from 'xpath';

globalThis.DOMParser = DOMParser as any;
globalThis.XMLSerializer = XMLSerializer;
const doc: any = new DOMParser().parseFromString(
  '<html lang="en"><body></body></html>',
  'text/html',
)!;

doc.implementation = {
  createHTMLDocument() {
    return new DOMParser().parseFromString(
      '<html lang="en"><body></body></html>',
      'text/html',
    )!;
  },
};

// https://developer.mozilla.org/en-US/docs/Web/API/XPathResult/resultType
export const XPathResult = {
  ANY_TYPE: 0,
  NUMBER_TYPE: 1,
  STRING_TYPE: 2,
  BOOLEAN_TYPE: 3,
  UNORDERED_NODE_ITERATOR_TYPE: 4,
  ORDERED_NODE_ITERATOR_TYPE: 5,
  UNORDERED_NODE_SNAPSHOT_TYPE: 6,
  ORDERED_NODE_SNAPSHOT_TYPE: 7,
  ANY_UNORDERED_NODE_TYPE: 8,
  FIRST_ORDERED_NODE_TYPE: 9,
} as const;

type XPathResultType = (typeof XPathResult)[keyof typeof XPathResult];

doc.evaluate = (
  expression: string,
  node: Node,
  _resolver: null,
  resultType: XPathResultType,
  _result: null,
) => {
  const xexpression = xpath.parse(expression);

  switch (resultType) {
    case XPathResult.NUMBER_TYPE:
      return {
        resultType,
        numberValue: xexpression
          .evaluate({ node, isHtml: true })
          .numberValue(),
      };

    case XPathResult.STRING_TYPE:
      return {
        resultType,
        numberValue: xexpression
          .evaluate({ node, isHtml: true })
          .stringValue(),
      };

    case XPathResult.BOOLEAN_TYPE:
      return {
        resultType,
        numberValue: xexpression
          .evaluate({ node, isHtml: true })
          .booleanValue(),
      };

    case XPathResult.FIRST_ORDERED_NODE_TYPE:
    case XPathResult.ANY_UNORDERED_NODE_TYPE: {
      const singleNodeValue = xexpression
        .evaluate({ node, isHtml: true })
        .nodes[0] ?? null;
      return {
        resultType,
        singleNodeValue,
      };
    }

    case XPathResult.ORDERED_NODE_SNAPSHOT_TYPE:
    case XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE: {
      const nodes = xexpression
        .evaluate({ node, isHtml: true })
        .nodes;

      return {
        resultType,
        snapshotLength: nodes.length,
        snapshotItem(index: number) {
          return nodes[index] ?? null;
        },
      };
    }

    case XPathResult.ORDERED_NODE_ITERATOR_TYPE:
    case XPathResult.UNORDERED_NODE_ITERATOR_TYPE: {
      const nodes = xexpression
        .evaluate({ node, isHtml: true })
        .nodes;
      let i = 0;

      return {
        resultType,
        iterateNext() {
          return nodes[i++] ?? null;
        },
      };
    }

    case XPathResult.ANY_TYPE:
    default: {
      const singleNodeValue = xexpression
        .evaluate({ node, isHtml: true })
        .nodes[0] ?? null;

      return {
        resultType: XPathResult.FIRST_ORDERED_NODE_TYPE,
        singleNodeValue,
      };
    }
  }
};

globalThis.document = doc as any;
globalThis.XPathResult = XPathResult as any;
