export function getNodeRange(
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  let range;

  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (!pos) return;
    range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY);
  }

  return range;
}

export function getOffsetWithinElement(element: Node, range: Range): number {
  const container = range.startContainer;
  const offsetInNode = range.startOffset;

  if (container === element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const firstText = walker.nextNode();
    if (!firstText) return offsetInNode;
    let total = 0;
    let node: Text | null = firstText as Text;
    while (node) {
      if (node === container) return total + offsetInNode;
      total += node.nodeValue?.length ?? 0;
      node = walker.nextNode() as Text | null;
    }
    return total;
  }

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let total = 0;
  let textNode = walker.nextNode() as Text | null;
  while (textNode) {
    if (textNode === container) {
      return total + offsetInNode;
    }
    total += textNode.nodeValue?.length ?? 0;
    textNode = walker.nextNode() as Text | null;
  }
  return -1;
}
