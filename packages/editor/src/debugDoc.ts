import {Node} from 'prosemirror-model';

function trimText(str: string, maxLen = 20): string {
  str = str.replaceAll('\n', '\\n');

  if (str.length <= maxLen) {
    return str;
  }

  return str.slice(0, maxLen) + '...';
}

export function debugDoc(node: Node, level = 0, currentPos = 0) {
  let delim = '';
  for (let i = 0; i < level; i++) {
    delim += '  ';
  }

  // https://prosemirror.net/docs/guide/#doc.indexing

  let line = '';
  line += ` - [${node.type.name}] `;
  line += `pos: ${currentPos}, `;
  line += `nodeSize: ${node.nodeSize}, `; // isLeaf ? 1 : 2 + this.content.size
  line += `fragment.size: ${node.content.size}, `;

  console.log(delim + line);

  let marksLine = '';
  for (const mark of node.marks) {
    marksLine += `(${mark.type.name}), `;
  }

  if (marksLine) {
    console.log(delim + '    ' + marksLine);
  }

  if (node.text) {
    console.log(delim + '    "' + trimText(node.text) + '"');
  }

  node.forEach((child, offset) => {
    debugDoc(child, level + 1, currentPos + offset); // + (node.isLeaf ? 1 : 2)
  });
}
