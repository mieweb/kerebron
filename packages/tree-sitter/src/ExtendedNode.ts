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
  _startIndexOffset: number;
  _startRowOffset: number;
  _startColOffset: number;
  _endIndexOffset: number;
  _endRowOffset: number;
  _endColOffset: number;
  getReferencePoint: GetReferencePoint;
}

class SoftNode {
  _startIndexOffset: number;
  _startRowOffset: number;
  _startColOffset: number;
  _endIndexOffset: number;
  _endRowOffset: number;
  _endColOffset: number;
  getReferencePoint: GetReferencePoint;
  tree: Tree;
  treeText: string;

  constructor(params: SoftNodeParams) {
    this.tree = params.tree;
    this.treeText = params.treeText;
    this.getReferencePoint = params.getReferencePoint;
    this._startIndexOffset = params._startIndexOffset;
    this._startRowOffset = params._startRowOffset;
    this._startColOffset = params._startColOffset;
    this._endIndexOffset = params._endIndexOffset;
    this._endRowOffset = params._endRowOffset;
    this._endColOffset = params._endColOffset;
  }

  get startIndex() {
    return this._startIndexOffset + this.getReferencePoint().index;
  }

  get startPosition() {
    return {
      row: this._startRowOffset + this.getReferencePoint().position.row,
      column: this._startColOffset + this.getReferencePoint().position.column,
    };
  }

  get endIndex() {
    return this._endIndexOffset + this.getReferencePoint().index;
  }

  get endPosition() {
    return {
      row: this._endRowOffset + this.getReferencePoint().position.row,
      column: this._endColOffset + this.getReferencePoint().position.column,
    };
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
    return this.node.startPosition;
  }

  get endPosition() {
    return this.node.endPosition;
  }

  get text(): string {
    return this.treeText.substring(this.startIndex, this.endIndex);
  }

  get children(): TreeSitterNodeExt[] {
    let c: TreeSitterNodeExt[] = childrenWithSoftNodes(
      this,
      this._children,
      this.treeText,
      this.offsets,
    );

    for (const mapper of this.mappers) {
      c = mapper(c, this);
    }

    return c;
  }

  toJSON() {
    // console.log('tj', this.type);
    const children = this.children.map((i) => i.toJSON());
    // console.log('/tj', this.type);

    return {
      typeId: this.typeId,
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

export const childrenWithSoftNodes = (
  node: ExtendedNode,
  children: TreeSitterNode[],
  treeText: string,
  offsets?: Offsets,
): ExtendedNode[] => {
  if (children.length === 0) {
    return [];
  }

  // firstChild.startIndex += (offsets?.startIndex || 0);
  // firstChild.endIndex += (offsets?.startIndex || 0);

  interface CopiedChild {
    startIndex: number;
    endIndex: number;
    endPosition: { row: number; column: number };
    node: TreeSitterNode;
  }

  const adjustPos = (pos: { row: number; column: number }) => {
    const row = offsets?.startPosition.row || 0;
    const column = offsets?.startPosition.column || 0;

    return {
      row: pos.row + row,
      column: pos.row > 0 ? pos.column : pos.column + column,
    };
  };

  const newChildren = [];
  const childrenCopy: Array<CopiedChild> = [...children].map((c) => {
    return {
      startIndex: c.startIndex + (offsets?.startIndex || 0),
      endIndex: c.endIndex + (offsets?.startIndex || 0),
      startPosition: adjustPos(c.startPosition),
      endPosition: adjustPos(c.endPosition),
      node: c,
    };
  });
  let firstChild: CopiedChild = childrenCopy.shift()!;

  const handleGaps = (
    gapText: string,
    getReferencePoint: GetReferencePoint,
    parentNode: TreeSitterNodeExt,
  ) => {
    const { index, position } = getReferencePoint();
    let start = index - (offsets?.startIndex || 0);
    let startPosition = position;
    const chunks = gapText.split(/(?<!\s)(?=\s+)/g);
    let colOffset = startPosition.column;
    let rowOffset = startPosition.row;
    for (const eachGap of chunks) {
      if (eachGap.length == 0) {
        continue;
      }
      const end = start + eachGap.length;
      if (eachGap.match(/^\s/)) {
        const rowOffsetBefore = rowOffset;
        const colOffsetBefore = colOffset;
        rowOffset += (eachGap.match(/\n/g) || []).length;
        // reset column offset on new row
        if (rowOffsetBefore != rowOffset) {
          colOffset = eachGap.split('\n').slice(-1)[0].length;
        } else {
          colOffset += eachGap.length;
        }
        newChildren.push(
          new WhitespaceNode({
            tree: node.tree,
            treeText,
            parent: parentNode,
            getReferencePoint,
            text: eachGap,
            _startIndexOffset: start - index,
            _startRowOffset: rowOffsetBefore - position.row,
            _startColOffset: colOffsetBefore - position.column,
            _endIndexOffset: end - index,
            _endRowOffset: rowOffset - position.row,
            _endColOffset: colOffset - position.column,
          }),
        );
        // sometimes the gap isn't always whitespace
      } else {
        const colOffsetBefore = colOffset;
        colOffset += eachGap.length;
        newChildren.push(
          new SoftTextNode({
            tree: node.tree,
            treeText,
            parent: parentNode,
            getReferencePoint,
            text: eachGap,
            _startIndexOffset: start - index,
            _startRowOffset: rowOffset - position.row,
            _startColOffset: colOffsetBefore - position.column,
            _endIndexOffset: end - index,
            _endRowOffset: rowOffset - position.row,
            _endColOffset: colOffset - position.column,
          }),
        );
      }
      start = end;
    }
  };

  // preceding whitespace
  if (node.startIndex != firstChild.startIndex) {
    const thisNode = node;
    const gapText = treeText.slice(node.startIndex, firstChild.startIndex);
    // whitespace and non-whitespace chunks

    handleGaps(
      gapText,
      () => ({
        index: thisNode.startIndex,
        position: thisNode.startPosition,
      }),
      node,
    );
  }
  newChildren.push(firstChild.node);
  // gaps between sibilings
  let prevChild = firstChild;
  for (const eachSecondaryNode of childrenCopy) {
    if (prevChild.endIndex != eachSecondaryNode.startIndex) {
      const thisChild = prevChild;
      const gapText = treeText.slice(
        prevChild.endIndex,
        eachSecondaryNode.startIndex,
      );

      handleGaps(
        gapText,
        () => ({
          index: thisChild.endIndex,
          position: thisChild.endPosition,
        }),
        node,
      );
    }
    newChildren.push(eachSecondaryNode.node);
    prevChild = eachSecondaryNode;
  }

  // gap between last child and parent
  if (prevChild.endIndex != node.endIndex) {
    const gapText = treeText.slice(prevChild.endIndex, node.endIndex);
    const thisChild = prevChild;
    handleGaps(
      gapText,
      () => ({ index: thisChild.endIndex, position: thisChild.endPosition }),
      node,
    );
  }

  return newChildren.map((item) => {
    const extNode = new ExtendedNode(item, treeText, offsets);
    extNode.mappers = node.mappers;
    return extNode;
  });
};
