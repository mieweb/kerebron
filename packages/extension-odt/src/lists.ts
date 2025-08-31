import { OdtElement } from './OdtParser.ts';

export class ListNumbering {
  levels: { [level: number]: number } = {};
  levelNodes: { [level: number]: Node } = {};

  constructor() {
    for (let i = 0; i < 20; i++) {
      this.levels[i] = 1;
    }
  }

  clearAbove(level: number) {
    for (let i = level + 1; i < 20; i++) {
      this.levels[i] = 1;
    }
  }

  setLevelNode(level: number, node: Node) {
    this.levelNodes[level] = node;
  }
}

export interface List {
  level: number;
  odtElement: OdtElement;
}

export class ListTracker {
  listStack: List[] = [];

  listNumberings: Map<string, ListNumbering> = new Map<string, ListNumbering>();
  lastNumbering?: ListNumbering;
  preserveMinLevel = 999;
}
