import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import type { MenuElement } from '@kerebron/extension-menu';
import type { ExtensionLsp } from './ExtensionLsp.ts';

const CSS_PREFIX = 'kb-lsp-status';

export type LspConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface LspStatusOptions {
  /** The LSP extension instance to monitor */
  lspExtension: ExtensionLsp;
  /** Optional label to show (e.g., 'LSP' or language name) */
  label?: string;
}

/**
 * A menu element that displays LSP connection status.
 * Shows a status indicator dot with an optional label.
 */
export class LspStatusElement implements MenuElement {
  private lspExtension: ExtensionLsp;
  private label: string;
  private dom: HTMLElement | null = null;
  private statusDot: HTMLElement | null = null;
  private labelEl: HTMLElement | null = null;
  private status: LspConnectionStatus = 'disconnected';
  private statusCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: LspStatusOptions) {
    this.lspExtension = options.lspExtension;
    this.label = options.label ?? 'LSP';
  }

  render(
    _view: EditorView,
  ): { dom: HTMLElement; update: (state: EditorState) => boolean } {
    // Create main container
    this.dom = document.createElement('div');
    this.dom.className = CSS_PREFIX;
    this.dom.setAttribute('role', 'status');
    this.dom.setAttribute('aria-live', 'polite');

    // Create status indicator
    const indicator = document.createElement('div');
    indicator.className = `${CSS_PREFIX}__indicator`;

    // Status dot
    this.statusDot = document.createElement('span');
    this.statusDot.className =
      `${CSS_PREFIX}__dot ${CSS_PREFIX}__dot--disconnected`;
    indicator.appendChild(this.statusDot);

    // Label
    this.labelEl = document.createElement('span');
    this.labelEl.className = `${CSS_PREFIX}__label`;
    this.labelEl.textContent = this.label;
    indicator.appendChild(this.labelEl);

    this.dom.appendChild(indicator);

    // Set initial status based on client state
    this.updateStatusFromClient();

    // Poll for status changes since the client is created lazily
    this.statusCheckInterval = setInterval(() => {
      this.updateStatusFromClient();
    }, 1000);

    const update = (_state: EditorState): boolean => {
      // Always visible
      return true;
    };

    return { dom: this.dom, update };
  }

  private getClient() {
    const mainLang = this.lspExtension.mainLang || 'markdown';
    return this.lspExtension.getClient(mainLang);
  }

  private updateStatusFromClient() {
    const client = this.getClient();
    // Check if the client has server capabilities (meaning it's connected and initialized)
    if (client?.serverCapabilities) {
      this.setStatus('connected');
    } else if (client?.active) {
      this.setStatus('connecting');
    } else {
      this.setStatus('disconnected');
    }
  }

  private setStatus(status: LspConnectionStatus) {
    if (this.status === status) return; // No change

    this.status = status;
    if (this.statusDot) {
      this.statusDot.className =
        `${CSS_PREFIX}__dot ${CSS_PREFIX}__dot--${status}`;
    }
    if (this.dom) {
      this.dom.setAttribute('data-status', status);
      const statusLabels = {
        connected: 'LSP Connected',
        connecting: 'LSP Connecting...',
        disconnected: 'LSP Disconnected',
      };
      this.dom.title = statusLabels[status];
      this.dom.setAttribute('aria-label', statusLabels[status]);
    }
  }

  destroy() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }
}
