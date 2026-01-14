export class ListNumbering {
  levels: { [level: number]: number } = {};
  forceStart: { [level: number]: boolean } = {};

  constructor(public readonly id: string) {
    for (let i = 0; i < 20; i++) {
      this.levels[i] = 1;
    }
  }

  clearAbove(level: number) {
    for (let i = level + 1; i < 20; i++) {
      this.levels[i] = 1;
    }
  }

  clone(id: string): ListNumbering {
    const retVal = new ListNumbering(id);

    retVal.levels = structuredClone(retVal.levels);
    retVal.forceStart = structuredClone(retVal.forceStart);

    return retVal;
  }
}

export interface List {
  level: number;
  id?: string;
  styleName: string;
}

export class ListTracker {
  listStack: List[] = [];

  pushList(id?: string, styleName = ''): List {
    const list: List = {
      id,
      styleName,
      level: this.listStack.length + 1,
    };
    this.listStack.push(list);
    return list;
  }

  getCurrentList(): List {
    return this.listStack[this.listStack.length - 1];
  }
}
