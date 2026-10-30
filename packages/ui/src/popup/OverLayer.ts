export class OverLayer {
  readonly overLayerContainer: HTMLElement;
  readonly centerElement: HTMLElement;

  constructor(container?: HTMLElement) {
    if (!container) {
      container = document.body.querySelector<HTMLElement>('.kb--over-layer') ||
        undefined;
      if (!container) {
        container = document.createElement('div');
        container.classList.add('kb--over-layer');
        document.body.appendChild(container);
      }
    }
    this.overLayerContainer = container;

    const centerElement = this.overLayerContainer.querySelector<HTMLElement>(
      '.kb--over-layer__center',
    );
    if (centerElement) {
      this.centerElement = centerElement;
    } else {
      this.centerElement = document.createElement('div');
      this.centerElement.classList.add('kb--over-layer__center');
      this.centerElement.dataset.anchor = '--center' +
        Math.random().toString(36).substring(2, 12);
      this.centerElement.style.anchorName = this.centerElement.dataset.anchor;
      this.addElement(this.centerElement);
    }
  }

  createElement<T extends HTMLElement>(type: string): T {
    const element = document.createElement(type);
    return this.addElement(element);
  }

  addElement<T extends HTMLElement>(
    element: HTMLElement,
  ): T {
    this.overLayerContainer.appendChild(element);
    return element as T;
  }
}

export interface AnchorParams {
  container?: HTMLElement;
  above?: boolean;
}

export function anchorElement(
  popover: HTMLElement,
  anchorId: string,
  params?: AnchorParams,
) {
  popover.style.positionAnchor = `${anchorId}`;
}
