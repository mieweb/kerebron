export function getShadowRoot(element?: Element): ShadowRoot | undefined {
  let current = element;

  while (current) {
    if (current.toString() === '[object ShadowRoot]') {
      return current as unknown as ShadowRoot;
    }
    if (current instanceof ShadowRoot) {
      if (current.host) {
        return current.host.shadowRoot || undefined;
      }
    }
    current = current.parentElement ||
      ((current instanceof ShadowRoot) ? current.host : undefined);
  }

  return undefined;
}
