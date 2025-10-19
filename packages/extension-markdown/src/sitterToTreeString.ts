import type { Node } from 'prosemirror-model';
import { SmartOutput } from './utilities/SmartOutput.ts';

function trimText(str: string, maxLen = 20): string {
  str = str.replaceAll('\n', '\\n');

  if (str.length <= maxLen) {
    return str;
  }

  return str.slice(0, maxLen) + '...';
}

export interface NodeAndPos {
  node: Node;
  pos: number;
}

export function nodeToTreeStringOutput(
  output: SmartOutput<NodeAndPos>,
  node: Node | Node[] | readonly Node[],
  level = 0,
  currentPos = 0,
) {
  let delim = '';
  for (let i = 0; i < level; i++) {
    delim += '  ';
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      output.log(delim, { node: child, pos: currentPos });
      nodeToTreeStringOutput(output, child, level + 1, currentPos);
      // .replace(/\s+$/gm, '') +
      // '\n'
    }
    return;
  }

  // https://prosemirror.net/docs/guide/#doc.indexing

  let line = '';
  // if (node.type) {
  if ('type' in node) {
    line += ` - [${node.type.name}] `;
    // } else {
    //   line += ` - `;
    // }
    line += `pos: ${currentPos}, `;
    line += `nodeSize: ${node.nodeSize}, `; // isLeaf ? 1 : 2 + this.content.size
    line += `epos: ${currentPos + node.nodeSize}, `; // isLeaf ? 1 : 2 + this.content.size
    if (node.content) {
      line += `fragment.size: ${node.content.size}, `;
    }

    output.log((delim + line) + '\n', { node, pos: currentPos });

    let marksLine = '';
    if (node.marks) {
      for (const mark of node.marks) {
        marksLine += `(${mark.type.name}), `;
      }
    }

    if (marksLine) {
      output.log((delim + '    ' + marksLine) + '\n', {
        node,
        pos: currentPos,
      });
    }

    if (node.text) {
      output.log((delim + '    "' + trimText(node.text) + '"') + '\n', {
        node,
        pos: currentPos,
      });
    }
  }

  node.forEach((child, offset) => {
    // output +=
    nodeToTreeStringOutput(output, child, level + 1, currentPos + offset + 1);
    //   .replace(
    //   /\s+$/gm,
    //   '',
    // ) + '\n'; // + (node.isLeaf ? 1 : 2)
  });

  return output;
}

export function sitterToTreeString(node: Node | Node[] | readonly Node[]) {
  const output = new SmartOutput<NodeAndPos>();
  nodeToTreeStringOutput(output, node);
  return output.toString();
}

export function debugNode(node: Node | Node[]) {
  console.debug(sitterToTreeString(node));
}
