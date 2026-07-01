export class OverLayer {
  overLayerContainer: HTMLElement;

  stack: HTMLElement[] = [];

  constructor(container?: HTMLElement) {
    if (!container) {
      container = document.createElement('div');
      document.body.appendChild(container);
      container.classList.add('kb--top-layer');
    }

    this.overLayerContainer = container;
  }

  private removeStacked(start: number) {
    for (let i = this.stack.length - 1; i >= start; i--) {
      if (this.overLayerContainer.contains(this.stack[i])) {
        this.overLayerContainer.removeChild(this.stack[i]);
      }
    }
    this.stack.splice(start, this.stack.length - start);
  }

  createElement<T extends HTMLElement>(
    type: string,
    ancestor?: HTMLElement,
  ): T {
    const element = document.createElement(type);
    this.overLayerContainer.appendChild(element);

    const observer = new MutationObserver((mutations) => {
      if (!element.isConnected) {
        observer.disconnect();
        const idx = this.stack.findIndex((item) => item === element);
        if (idx > -1) {
          this.removeStacked(idx);
        }
        element.dispatchEvent(new CustomEvent('removed'));
      }
    });

    if (ancestor) {
      const idx = this.stack.findIndex((item) => item === ancestor);
      if (idx > -1) {
        this.removeStacked(idx + 1);
      }
    } else {
      this.removeStacked(0);
    }

    this.stack.push(element);

    observer.observe(this.overLayerContainer, {
      childList: true,
    });

    return element as T;
  }
}

export interface AnchorParams {
  container?: HTMLElement;
  above?: boolean;
}

export function anchorElement(
  popover: HTMLElement,
  anchorSelector: string,
  params?: AnchorParams,
) {
  let rafId: number | null = null;

  popover.style.position = 'fixed';
  popover.setAttribute('data-anchor-selector', anchorSelector);

  function update() {
    rafId = null;

    const container: HTMLElement = params?.container || document.body;
    const anchor = container.querySelector(anchorSelector);

    if (anchor) {
      const rect = anchor.getBoundingClientRect();

      if (params?.above) {
        popover.style.left = `${rect.left}px`;
        popover.style.top = `${rect.top - popover.clientHeight}px`;
      } else {
        popover.style.left = `${rect.left}px`;
        popover.style.top = `${rect.bottom}px`;
      }

      popover.style.display = '';
    } else {
      const ids = [];
      const nodes = container.querySelectorAll('[data-decoration-id]');
      nodes.forEach((n) => ids.push(n.getAttribute('data-decoration-id')));

      // console.debug('!anchorSelector', anchorSelector, ids);
      popover.style.display = 'none';
      scheduleUpdate();
    }
  }

  function scheduleUpdate() {
    if (!rafId) {
      rafId = requestAnimationFrame(update);
    }
  }

  update();

  // const resizeObserver = new ResizeObserver(scheduleUpdate);
  // resizeObserver.observe(anchor);

  // const moveObserver = new IntersectionObserver(scheduleUpdate);
  // moveObserver.observe(anchor);

  if (params?.container) {
    const observer = new MutationObserver((mutations) => {
      scheduleUpdate();
    });

    observer.observe(params?.container, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  window.addEventListener('resize', scheduleUpdate, true);
  document.addEventListener('scroll', scheduleUpdate, true);

  popover.addEventListener('removed', () => {
    // resizeObserver.disconnect();
    // moveObserver.disconnect();
    window.removeEventListener('resize', scheduleUpdate, true);
    document.removeEventListener('scroll', scheduleUpdate, true);

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });
}
