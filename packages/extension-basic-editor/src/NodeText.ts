import { NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

export class NodeText extends Node {
  override name = 'text';

  override getNodeSpec(): NodeSpec {
    return {
      group: 'inline',
    };
  }
}
