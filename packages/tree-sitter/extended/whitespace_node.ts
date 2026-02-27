import { SoftNode } from './soft_node.ts';

export class WhitespaceNode extends SoftNode {
  constructor({ parent, ...data }) {
    super({ ...data, type: 'whitespace', typeId: -1 });
    this._parent = parent;
  }
  get parent() {
    return this._parent;
  }
}
