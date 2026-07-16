import { Tree } from 'web-tree-sitter';

export interface TreeSitterNode {
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
  parent: TreeSitterNodeExt | null;
  text: string;
  children: TreeSitterNodeExt[] = [];

  constructor(params: WhitespaceNodeParams) {
    super(params);
    this.parent = params.parent;
    this.text = params.text;
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
  parent: TreeSitterNode | null;
  text: string;
  children: TreeSitterNodeExt[] = [];

  constructor(params: SoftTextNodeParams) {
    super(params);
    this.parent = params.parent;
    this.text = params.text;
  }

  toJSON() {
    return {
      type: this.type,
      typeId: this.typeId,
      text: this.text,
    };
  }
}

export class ExtendedNode implements TreeSitterNodeExt {
  xxx = 1;
  tree: Tree;
  type: string;
  typeId: number;
  text: string;
  _children: TreeSitterNode[];
  parent: TreeSitterNode | null;

  constructor(private node: TreeSitterNode, public readonly treeText: string) {
    this.tree = node.tree;
    this.treeText = treeText;
    this.type = node.type;
    this.typeId = node.typeId;
    this.text = node.text;
    this.parent = node.parent;
    this._children = node.children;
  }

  get startIndex() {
    return this.node.startIndex;
  }

  get endIndex() {
    return this.node.endIndex;
  }

  get startPosition() {
    return this.node.startPosition;
  }

  get endPosition() {
    return this.node.endPosition;
  }

  get children(): TreeSitterNodeExt[] {
    return childrenWithSoftNodes(this, this._children, this.treeText);
  }

  toJSON() {
    return {
      typeId: this.typeId,
      type: this.type,
      text: this.text,
      startIndex: this.startIndex,
      endIndex: this.endIndex,
      children: this.children.map((i) => i.toJSON()),
    };
  }
}

export const childrenWithSoftNodes = (
  node: TreeSitterNodeExt,
  children: TreeSitterNode[],
  treeText: string,
): TreeSitterNodeExt[] => {
  if (children?.length > 0) {
    const newChildren = [];
    const childrenCopy = [...children];
    let firstChild = childrenCopy.shift()!;

    const handleGaps = (
      gapText: string,
      getReferencePoint: GetReferencePoint,
      parentNode: TreeSitterNodeExt,
    ) => {
      const { index, position } = getReferencePoint();
      let start = index;
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
    newChildren.push(firstChild);
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
      newChildren.push(eachSecondaryNode);
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
        `L ${prevChild.endIndex} ${node.endIndex} `,
      );
    }

    return newChildren.map((item) => new ExtendedNode(item, treeText));
  }

  return [];
};
