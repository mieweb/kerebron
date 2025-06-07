/**
 * Kerebron Styles Export
 * Import this file to get all Kerebron editor styles
 */

// Note: In a browser environment, you would import the CSS directly
// For now, we export the CSS file paths for bundlers to pick up

export const KEREBRON_STYLES = {
  tokens: new URL('./styles/tokens.css', import.meta.url).href,
  base: new URL('./styles/base.css', import.meta.url).href,
  menu: new URL('./styles/menu.css', import.meta.url).href,
  mobile: new URL('./styles/mobile.css', import.meta.url).href,
  index: new URL('./styles/index.css', import.meta.url).href,
};

/**
 * Get the complete Kerebron stylesheet URL
 * Use this in your HTML or CSS imports
 */
export function getKerebronStylesheet(): string {
  return KEREBRON_STYLES.index;
}

/**
 * Inject Kerebron styles into the document head
 * Useful for dynamic imports or testing
 */
export function injectKerebronStyles(): void {
  if (typeof document === 'undefined') {
    console.warn('injectKerebronStyles: document not available');
    return;
  }

  const existingLink = document.querySelector('link[data-kerebron-styles]');
  if (existingLink) {
    return; // Already injected
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = getKerebronStylesheet();
  link.setAttribute('data-kerebron-styles', 'true');
  document.head.appendChild(link);
}