import { Node as PmNode } from 'prosemirror-model';

export type GetLocalPos = (
  textOffset: number,
) => undefined | {
  pos: number;
  nodePos: number;
  textOffset: number;
  element: HTMLElement;
  node: PmNode;
};

// const $position = this.editor.state.doc.resolve(pos);
// pos === $position.pos
// textOffset === $position.textOffset

export function getLocalElement(
  container: Document | ShadowRoot,
  element: Node | undefined,
): (Node & { getLocalPos: GetLocalPos }) | undefined {
  let maxDepth = 10;
  while (maxDepth > 0 && element) {
    if (element === container.firstChild) {
      break;
    }

    if ('getLocalPos' in element) {
      return element as Node & { getLocalPos: GetLocalPos };
    }

    maxDepth--;
    element = element.parentNode || undefined;
  }
}
