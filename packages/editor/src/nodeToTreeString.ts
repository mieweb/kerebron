import {Node} from 'prosemirror-model';

function trimText(str: string, maxLen = 20): string {
  str = str.replaceAll('\n', '\\n');

  if (str.length <= maxLen) {
    return str;
  }

  return str.slice(0, maxLen) + '...';
}

export function nodeToTreeString(node: Node | Node[] | readonly Node[], level = 0, currentPos = 0) {
  let delim = '';
  for (let i = 0; i < level; i++) {
    delim += '  ';
  }

  let output = '';
  if (Array.isArray(node)) {
    for (const child of node) {
      output += delim + nodeToTreeString(child, level + 1, currentPos).replace(/\s+$/gm, '') + '\n';
    }
    return output;
  }

  // https://prosemirror.net/docs/guide/#doc.indexing

  let line = '';
  // if (node.type) {
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

  output += (delim + line) + '\n';

  let marksLine = '';
  if (node.marks) {
    for (const mark of node.marks) {
      marksLine += `(${mark.type.name}), `;
    }
  }

  if (marksLine) {
    output += (delim + '    ' + marksLine) + '\n';
  }

  if (node.text) {
    output += (delim + '    "' + trimText(node.text) + '"') + '\n';
  }

  node.forEach((child, offset) => {
    output += nodeToTreeString(child, level + 1, currentPos + offset + 1).replace(/\s+$/gm, '') + '\n'; // + (node.isLeaf ? 1 : 2)
  });

  return output;
}

export function debugNode(node: Node | Node[]) {
  console.debug(nodeToTreeString(node));
}
