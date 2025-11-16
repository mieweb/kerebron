export function getShadowRoot(element?: HTMLElement) {
  let current = element;

  while (current) {
    if (current.toString() === '[object ShadowRoot]') {
      return current;
    }
    if (current.host) {
      return current.host.shadowRoot;
    }
    current = current.parentNode || current.host;
  }

  return undefined;
}
