import type { CoreEditor } from './CoreEditor.ts';

interface SelectParams {
  anchor: number;
  scrollIntoView: boolean;
  userEvent: string;
}

export interface EditorUi {
  showMessage(msg: string): void;
  showError(err: Error): void;
  showStatus?(msg: string, type?: 'info' | 'warning' | 'error'): void;
  focus(): void;
  select(params: SelectParams): void;
}

export function defaultUi(editor: CoreEditor): EditorUi {
  let statusTimeout: number | undefined;
  let statusElement: HTMLDivElement | null = null;

  return {
    showMessage(msg: string) {
      globalThis.alert(msg);
    },
    showError(err: Error) {
      globalThis.alert(err.message);
      console.error(err);
    },
    showStatus(msg: string, type: 'info' | 'warning' | 'error' = 'info') {
      // Create status element if it doesn't exist
      if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          transition: opacity 0.3s ease;
          max-width: 400px;
        `;
        document.body.appendChild(statusElement);
      }

      // Clear existing timeout
      if (statusTimeout) {
        clearTimeout(statusTimeout);
      }

      // Set color based on type
      const colors = {
        info: { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
        warning: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
        error: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
      };
      const color = colors[type];
      statusElement.style.backgroundColor = color.bg;
      statusElement.style.color = color.text;
      statusElement.style.border = `1px solid ${color.border}`;
      statusElement.textContent = msg;
      statusElement.style.opacity = '1';

      // Auto-hide after 3 seconds
      statusTimeout = setTimeout(() => {
        if (statusElement) {
          statusElement.style.opacity = '0';
        }
      }, 3000);
    },
    focus() {
      // editor.run.focus();
    },
    select({
      anchor: number,
      scrollIntoView: boolean,
      userEvent: string,
    }) {
    },
  };
}
