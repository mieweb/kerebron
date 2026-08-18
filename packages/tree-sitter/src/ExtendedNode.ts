import { Node, Query, Tree } from 'web-tree-sitter';
import { QueryError, QueryOptions } from './Query.ts';

export interface TreeSitterNode {
  id: number;
  tree: Tree;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  type: string;
  typeId: number;
  text: string;
  children: TreeSitterNode[];
  parent: TreeSitterNode | null;
}

export interface TreeSitterNodeExt extends TreeSitterNode {
  treeText: string;
  toJSON: () => any;
}

interface Position {
  row: number;
  column: number;
}

type GetReferencePoint = () => {
  index: number;
  position: Position;
};

interface SoftNodeParams {
  tree: Tree;
  treeText: string;
  startIndex: number;
  startPosition: Position;
  endIndex: number;
  endPosition: Position;
}

class SoftNode {
  readonly startIndex: number;
  readonly startPosition: Position;
  readonly endIndex: number;
  readonly endPosition: Position;
  tree: Tree;
  treeText: string;

  constructor(params: SoftNodeParams) {
    this.tree = params.tree;
    this.treeText = params.treeText;
    this.startIndex = params.startIndex;
    this.startPosition = params.startPosition;
    this.endIndex = params.endIndex;
    this.endPosition = params.endPosition;
  }
}

interface WhitespaceNodeParams extends SoftNodeParams {
  parent: TreeSitterNodeExt | null;
  text: string;
}

class WhitespaceNode extends SoftNode implements TreeSitterNodeExt {
  type = 'whitespace';
  typeId = -1;
  id: number;
  parent: TreeSitterNodeExt | null;
  text: string;
  children: TreeSitterNodeExt[] = [];

  constructor(params: WhitespaceNodeParams) {
    super(params);
    this.parent = params.parent;
    this.text = params.text;
    this.id = -1;
  }

  toJSON() {
    return {
      type: this.type,
      typeId: this.typeId,
      text: this.text,
    };
  }
}

interface SoftTextNodeParams extends SoftNodeParams {
  parent: TreeSitterNode | null;
  text: string;
}

class SoftTextNode extends SoftNode implements TreeSitterNodeExt {
  type = 'text';
  typeId = -2;
  id: number;
  parent: TreeSitterNode | null;
  text: string;
  children: TreeSitterNodeExt[] = [];

  constructor(params: SoftTextNodeParams) {
    super(params);
    this.parent = params.parent;
    this.text = params.text;
    this.id = -1;
  }

  toJSON() {
    return {
      type: this.type,
      typeId: this.typeId,
      text: this.text,
    };
  }
}

type ExtendedNodeMapper = (
  nodes: TreeSitterNodeExt[],
  parent: TreeSitterNodeExt,
) => TreeSitterNodeExt[];

interface Offsets {
  startIndex: number;
  startPosition: { row: number; column: number };
}

export class ExtendedNode implements TreeSitterNodeExt {
  tree: Tree;
  type: string;
  typeId: number;
  // text: string;
  _children: TreeSitterNode[];
  parent: TreeSitterNode | null;
  id: number;

  mappers: Array<ExtendedNodeMapper> = [];

  constructor(
    private node: TreeSitterNode,
    public readonly treeText: string,
    private readonly offsets?: Offsets,
  ) {
    this.id = node.id;
    this.tree = node.tree;
    this.treeText = treeText;
    this.type = node.type;
    this.typeId = node.typeId;
    this.parent = node.parent;
    this._children = node.children;
  }

  get startIndex() {
    return this.node.startIndex + (this.offsets?.startIndex || 0);
  }

  get endIndex() {
    return this.node.endIndex + (this.offsets?.startIndex || 0);
  }

  get startPosition() {
    return incrementPositionByOffset(
      this.node.startPosition,
      this.offsets?.startPosition,
    );
  }

  get endPosition() {
    return incrementPositionByOffset(
      this.node.endPosition,
      this.offsets?.startPosition,
    );
  }

  get text(): string {
    return this.treeText.substring(this.startIndex, this.endIndex);
  }

  get children(): TreeSitterNodeExt[] {
    let c: TreeSitterNodeExt[] = childrenWithSoftNodes(
      this,
      this._children,
      this.offsets,
    );

    for (const mapper of this.mappers) {
      c = mapper(c, this);
    }

    return c;
  }

  toJSON() {
    const children = this.children.map((i) => i.toJSON());

    return {
      type: this.type,
      text: this.text,
      startIndex: this.startIndex,
      endIndex: this.endIndex,
      children,
    };
  }

  query(queryString: string, options: QueryOptions) {
    const { matchLimit } = options || {};
    let query;
    try {
      query = new Query(this.tree.language, queryString);
    } catch (error) {
      if (error instanceof QueryError) {
        error.message = `${error.message} in the following query: ${
          JSON.stringify(queryString)
        }`;
      }
      throw error;
    }
    const result = query.matches(this as any, {
      startPosition: this.startPosition,
      endPosition: this.endPosition,
      matchLimit,
    });
    // without this soft nodes will be missing
    for (const eachResult of result) {
      for (const eachCapture of eachResult.captures) {
        const extNode = new ExtendedNode(
          eachCapture.node as any,
          this.treeText,
        );
        extNode.mappers = this.mappers;
        eachCapture.node = extNode as any;
      }
    }
    return result;
  }
}

function incrementPositionByOffset(pos: Position, offsets?: Position) {
  const row = offsets?.row || 0;
  const column = offsets?.column || 0;

  if (row === 0) {
    return {
      row: pos.row,
      column: pos.column + column,
    };
  } else {
    return {
      row: pos.row + row,
      column: pos.column,
    };
  }
}

function incrementPositionByText(pos: Position, text: string): Position {
  const rows = text.split('\n');
  const lastLine = rows.pop() || '';

  return incrementPositionByOffset(pos, {
    row: rows.length,
    column: lastLine.length,
  });
}

export const childrenWithSoftNodes = (
  parentNode: ExtendedNode,
  children: TreeSitterNode[],
  offsets?: Offsets,
): ExtendedNode[] => {
  if (children.length === 0) {
    return [];
  }

  interface CopiedChild {
    startIndex: number;
    endIndex: number;
    endPosition: { row: number; column: number };
    node: TreeSitterNode;
  }

  const newChildren = [];
  const childrenCopy: Array<CopiedChild> = [...children].map((c) => {
    return {
      startIndex: c.startIndex + (offsets?.startIndex || 0),
      endIndex: c.endIndex + (offsets?.startIndex || 0),
      startPosition: incrementPositionByOffset(
        c.startPosition,
        offsets?.startPosition,
      ),
      endPosition: incrementPositionByOffset(
        c.endPosition,
        offsets?.startPosition,
      ),
      node: c,
    };
  });
  const firstChild: CopiedChild = childrenCopy.shift()!;
  // console.log('firstChild', toJSON(firstChild), toJSON(node));

  const handleGaps = (
    gapText: string,
    index: number,
    position: Position,
  ) => {
    let startIndex = index; // - (offsets?.startIndex || 0);
    let startPosition = position;
    const chunks = gapText.split(/(?<!\s)(?=\s+)/g);
    // let colOffset = startPosition.column;
    // let rowOffset = startPosition.row;

    for (const text of chunks) {
      if (text.length == 0) {
        continue;
      }
      const endIndex = startIndex + text.length;
      const endPosition = incrementPositionByText(position, text);

      // console.log('CZUNK', text);

      const whiteMatch = text.match(/^\s+/);

      if (whiteMatch) {
        const whitePrefix = whiteMatch[0];
        const suffix = text.substring(whitePrefix.length);

        // const endPosition = incrementPositionByText(position, text);

        newChildren.push(
          new WhitespaceNode({
            tree: parentNode.tree,
            treeText: parentNode.treeText,
            parent: parentNode,
            text: whitePrefix,
            startIndex,
            endIndex: startIndex + whitePrefix.length,
            startPosition,
            endPosition: incrementPositionByText(startPosition, whitePrefix),
          }),
        );
        newChildren.push(
          new SoftTextNode({
            tree: parentNode.tree,
            treeText: parentNode.treeText,
            parent: parentNode,
            text: suffix,
            startIndex: startIndex + whitePrefix.length,
            endIndex,
            startPosition: incrementPositionByText(startPosition, whitePrefix),
            endPosition,
          }),
        );

        // sometimes the gap isn't always whitespace
      } else {
        newChildren.push(
          new SoftTextNode({
            tree: parentNode.tree,
            treeText: parentNode.treeText,
            parent: parentNode,
            text,
            startIndex,
            endIndex,
            startPosition,
            endPosition,
          }),
        );
      }
      startIndex = endIndex;
      startPosition = endPosition;
    }
  };

  // preceding whitespace
  if (parentNode.startIndex != firstChild.startIndex) {
    const gapText = parentNode.treeText.slice(
      parentNode.startIndex,
      firstChild.startIndex,
    );
    // whitespace and non-whitespace chunks

    // console.log(` 1 handleGaps ${JSON.stringify(gapText)}`);
    handleGaps(
      gapText,
      parentNode.startIndex,
      parentNode.startPosition,
    );
  }

  const extNode = new ExtendedNode(
    firstChild.node,
    parentNode.treeText,
    offsets,
  );
  extNode.mappers = parentNode.mappers;
  newChildren.push(extNode);

  // gaps between sibilings
  let prevChild = firstChild;
  for (const eachSecondaryNode of childrenCopy) {
    if (prevChild.endIndex !== eachSecondaryNode.startIndex) {
      const gapText = parentNode.treeText.slice(
        prevChild.endIndex,
        eachSecondaryNode.startIndex,
      );

      // console.log(` 2 handleGaps ${JSON.stringify(gapText)}`);
      handleGaps(
        gapText,
        prevChild.endIndex,
        prevChild.endPosition,
      );
    }

    const extNode = new ExtendedNode(
      eachSecondaryNode.node,
      parentNode.treeText,
      offsets,
    );
    // console.log(` 2 EX ${JSON.stringify(extNode.text)}`);
    extNode.mappers = parentNode.mappers;
    newChildren.push(extNode);

    prevChild = eachSecondaryNode;
  }

  // gap between last child and parent
  if (prevChild.endIndex != parentNode.endIndex) {
    const gapText = parentNode.treeText.slice(
      prevChild.endIndex,
      parentNode.endIndex,
    );

    // console.log(` 3 handleGaps ${JSON.stringify(gapText)}`);
    handleGaps(
      gapText,
      prevChild.endIndex,
      prevChild.endPosition,
    );
  }

  return newChildren;
};
