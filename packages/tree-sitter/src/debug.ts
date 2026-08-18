import { Node, Query, Tree } from 'web-tree-sitter';

const quoteIfNeeded = (word: string) => {
  if (word.match(/[a-zA-Z0-9]+/)) {
    return word;
  } else {
    return JSON.stringify(word);
  }
};

function* traverse(
  node: Node,
  _parentNodes: Node[] = [],
): Generator<[Array<Node>, Node, string]> {
  // const { _parentNodes } = arg
  const parentNodes = [node, ..._parentNodes];
  if (node.children?.length == 0) {
    yield [_parentNodes, node, '-'];
  } else {
    yield [_parentNodes, node, '->'];
    for (const each of node.children || []) {
      if (each instanceof Node) {
        for (const eachInner of traverse(each, parentNodes)) {
          yield eachInner;
        }
      } else {
        yield [parentNodes, each, '-'];
      }
    }
    yield [_parentNodes, node, '<-'];
  }
}

/**
 * helpful for visualizing the AST
 *
 * @example
 * ```js
 * const tree = parser.parse({
 *     string: `
 *         function thing(arg1) {
 *             let a = 10
 *         }
 *     `,
 *     withWhitespace: false,
 * })
 * console.log(xmlStylePreview(tree.rootNode))
 * // <program>
 * //     <function_declaration>
 * //         <function text="function" />
 * //         <identifier text="thing" />
 * //         <formal_parameters>
 * //             <"(" text="(" />
 * //             <identifier text="arg1" />
 * //             <")" text=")" />
 * //         </formal_parameters>
 * //         <statement_block>
 * //             <"{" text="{" />
 * //             <lexical_declaration>
 * //                 <let text="let" />
 * //                 <variable_declarator>
 * //                     <identifier text="a" />
 * //                     <"=" text="=" />
 * //                     <number text="10" />
 * //                 </variable_declarator>
 * //             </lexical_declaration>
 * //             <"}" text="}" />
 * //         </statement_block>
 * //     </function_declaration>
 * // </program>
 * ```
 *
 * @param {Node} startNode -
 * @param {Object} options -
 * @param {Boolean} options.alwaysShowTextAttr - parent nodes will get a text attribute (NOTE: it can be massive for large trees)
 * @returns {String} output - html-like formatted string of the AST
 */
export function xmlStylePreview(
  startNode: Node,
  { alwaysShowTextAttr = false } = {},
) {
  //
  // usage
  //
  let output = '';
  let indent = '';
  for (const [parents, node, direction] of traverse(startNode)) {
    const pos = `${node.startIndex}-${node.endIndex}`;
    // const pos = `${node.startPosition.row + 1}:${node.startPosition.column + 1}-${node.endPosition.row + 1}:${node.endPosition.column + 1}`;
    if (direction == '-') {
      output += indent +
        `<${quoteIfNeeded(node.type)} text=${
          JSON.stringify(node.text)
        } /> [${pos}]\n`;
    } else {
      if (direction == '->') {
        if (alwaysShowTextAttr) {
          output += indent +
            `<${quoteIfNeeded(node.type)} text=${
              JSON.stringify(node.text)
            } /> [${pos}]\n`;
        } else {
          output += indent + `<${quoteIfNeeded(node.type)}> [${pos}]\n`;
        }
        indent += '    ';
      } else if (direction == '<-') {
        indent = indent.slice(0, -4);
        output += indent + `</${quoteIfNeeded(node.type)}> [${pos}]\n`;
      }
    }
  }
  return output;
}
