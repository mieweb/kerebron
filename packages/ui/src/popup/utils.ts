export function getCaretPos(contentEditable: HTMLElement) {
  if (!contentEditable.isContentEditable) {
    return undefined;
  }

  const selection = globalThis.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return undefined;
  }

  const range = selection.getRangeAt(0);

  if (!contentEditable.contains(range.startContainer)) {
    return undefined;
  }

  return range.getBoundingClientRect();
}

export function findClosestElement(
  elements: HTMLElement[],
  caretRect: DOMRect,
  position: 'above' | 'below',
): HTMLElement | undefined {
  let closest = undefined;
  let minDistance = Infinity;

  for (const el of elements) {
    const range = document.createRange();
    range.selectNodeContents(el);

    const rect = range.getBoundingClientRect();

    if (!rect.width && !rect.height) continue;

    if (position === 'above' && rect.bottom > caretRect.top) continue;
    if (position === 'below' && rect.top < caretRect.bottom) continue;

    const dx = Math.max(
      rect.left - caretRect.left,
      0,
      caretRect.left - rect.right,
    );
    const dy = Math.max(
      rect.top - caretRect.top,
      0,
      caretRect.top - rect.bottom,
    );

    const distance = Math.hypot(dx, dy);

    if (distance < minDistance) {
      minDistance = distance;
      closest = el;
    }
  }

  return closest;
}

type FocusablePosition = 'first' | 'last';

export function findFocusableChild(
  element?: HTMLElement,
  position: FocusablePosition = 'first',
): HTMLElement | undefined {
  if (!element) {
    return undefined;
  }

  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
    'iframe',
    'object',
    'embed',
    'summary',
  ].join(', ');

  const elements = Array.from(
    element.querySelectorAll<HTMLElement>(selector),
  ).filter((el) =>
    !el.hasAttribute('disabled') &&
    el.tabIndex >= 0 &&
    el.getAttribute('aria-hidden') !== 'true' &&
    el.getClientRects().length > 0
  );

  return position === 'first'
    ? elements[0] ?? undefined
    : elements.at(-1) ?? undefined;
}
