import { EditorState, Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type * as awarenessProtocol from 'y-protocols/awareness';

import type { MenuElement } from '@kerebron/extension-menu';

const CSS_PREFIX = 'kb-collab-status';

export interface CollaborationUser {
  clientId: number;
  name: string;
  color: string;
  colorLight?: string;
}

export interface CollaborationStatusOptions {
  /** The Yjs awareness instance */
  awareness: awarenessProtocol.Awareness;
  /** Called when connection status changes */
  onStatusChange?: (
    status: 'connected' | 'connecting' | 'disconnected',
  ) => void;
}

/**
 * Plugin key for accessing collaboration status state
 */
export const collaborationStatusPluginKey = new PluginKey<
  CollaborationStatusState
>('collaboration-status');

export interface CollaborationStatusState {
  status: 'connected' | 'connecting' | 'disconnected';
  users: CollaborationUser[];
}

/**
 * Creates a ProseMirror plugin that tracks collaboration status and user presence.
 * This plugin maintains state that can be accessed by other components.
 */
export function collaborationStatusPlugin(
  awareness: awarenessProtocol.Awareness,
  options: {
    onStatusChange?: (
      status: 'connected' | 'connecting' | 'disconnected',
    ) => void;
  } = {},
): Plugin {
  return new Plugin<CollaborationStatusState>({
    key: collaborationStatusPluginKey,

    state: {
      init(): CollaborationStatusState {
        return {
          status: 'connecting',
          users: getUsers(awareness),
        };
      },

      apply(tr, value): CollaborationStatusState {
        const meta = tr.getMeta(collaborationStatusPluginKey);
        if (meta) {
          return { ...value, ...meta };
        }
        return value;
      },
    },

    view(editorView) {
      const updateUsers = () => {
        const users = getUsers(awareness);
        editorView.dispatch(
          editorView.state.tr.setMeta(collaborationStatusPluginKey, { users }),
        );
      };

      awareness.on('change', updateUsers);

      return {
        destroy() {
          awareness.off('change', updateUsers);
        },
      };
    },
  });
}

function getUsers(awareness: awarenessProtocol.Awareness): CollaborationUser[] {
  const users: CollaborationUser[] = [];
  awareness.getStates().forEach((state, clientId) => {
    if (state.user) {
      users.push({
        clientId,
        name: state.user.name || `User ${clientId}`,
        color: state.user.color || '#888888',
        colorLight: state.user.colorLight,
      });
    }
  });
  return users;
}

/**
 * A menu element that displays collaboration status, user count, and a dropdown of users.
 */
export class CollaborationStatusElement implements MenuElement {
  private awareness: awarenessProtocol.Awareness;
  private provider: any;
  private dom: HTMLElement | null = null;
  private statusDot: HTMLElement | null = null;
  private userCount: HTMLElement | null = null;
  private dropdown: HTMLElement | null = null;
  private userList: HTMLElement | null = null;
  private isOpen = false;
  private status: 'connected' | 'connecting' | 'disconnected' = 'connecting';

  constructor(
    options: { awareness: awarenessProtocol.Awareness; provider: any },
  ) {
    this.awareness = options.awareness;
    this.provider = options.provider;
  }

  render(
    view: EditorView,
  ): { dom: HTMLElement; update: (state: EditorState) => boolean } {
    // Create main container
    this.dom = document.createElement('div');
    this.dom.className = `${CSS_PREFIX}`;
    this.dom.setAttribute('role', 'button');
    this.dom.setAttribute('aria-haspopup', 'true');
    this.dom.setAttribute('aria-expanded', 'false');

    // Create status indicator button
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${CSS_PREFIX}__button`;
    button.title = 'Collaboration status';
    button.setAttribute('aria-label', 'Collaboration status');

    // Status dot
    this.statusDot = document.createElement('span');
    this.statusDot.className =
      `${CSS_PREFIX}__dot ${CSS_PREFIX}__dot--connecting`;
    button.appendChild(this.statusDot);

    // User count badge
    this.userCount = document.createElement('span');
    this.userCount.className = `${CSS_PREFIX}__count`;
    this.userCount.textContent = '0';
    button.appendChild(this.userCount);

    // Dropdown chevron
    const chevron = document.createElement('span');
    chevron.className = `${CSS_PREFIX}__chevron`;
    chevron.innerHTML =
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
    button.appendChild(chevron);

    this.dom.appendChild(button);

    // Create dropdown
    this.dropdown = document.createElement('div');
    this.dropdown.className = `${CSS_PREFIX}__dropdown`;
    this.dropdown.style.display = 'none';

    // Dropdown header
    const header = document.createElement('div');
    header.className = `${CSS_PREFIX}__header`;
    header.textContent = 'Collaborators';
    this.dropdown.appendChild(header);

    // User list
    this.userList = document.createElement('div');
    this.userList.className = `${CSS_PREFIX}__users`;
    this.dropdown.appendChild(this.userList);

    this.dom.appendChild(this.dropdown);

    // Event handlers
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (this.isOpen && this.dom && !this.dom.contains(e.target as Node)) {
        this.closeDropdown();
      }
    };
    document.addEventListener('click', closeHandler);

    // Listen for awareness changes
    const awarenessChangeHandler = () => {
      this.updateUserList();
    };
    this.awareness.on('change', awarenessChangeHandler);

    // Listen for provider status changes
    if (this.provider && typeof this.provider.on === 'function') {
      this.provider.on('status', (event: { status: string }) => {
        this.setStatus(
          event.status as 'connected' | 'connecting' | 'disconnected',
        );
      });
    }

    // Initial update
    this.updateUserList();

    const update = (_state: EditorState): boolean => {
      // Always visible
      return true;
    };

    return { dom: this.dom, update };
  }

  private setStatus(status: 'connected' | 'connecting' | 'disconnected') {
    this.status = status;
    if (this.statusDot) {
      this.statusDot.className =
        `${CSS_PREFIX}__dot ${CSS_PREFIX}__dot--${status}`;
    }
    if (this.dom) {
      this.dom.setAttribute('data-status', status);
      const button = this.dom.querySelector('button');
      if (button) {
        const statusLabels = {
          connected: 'Connected',
          connecting: 'Connecting...',
          disconnected: 'Disconnected',
        };
        button.title = `${statusLabels[status]} - Click to see collaborators`;
      }
    }
  }

  private updateUserList() {
    if (!this.userList || !this.userCount) return;

    const users = getUsers(this.awareness);
    const currentClientId = this.awareness.clientID;

    // Update count (including self)
    this.userCount.textContent = String(users.length);

    // Clear and rebuild user list
    this.userList.innerHTML = '';

    if (users.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = `${CSS_PREFIX}__empty`;
      emptyMessage.textContent = 'No users connected';
      this.userList.appendChild(emptyMessage);
      return;
    }

    // Sort users: current user first, then alphabetically
    const sortedUsers = [...users].sort((a, b) => {
      if (a.clientId === currentClientId) return -1;
      if (b.clientId === currentClientId) return 1;
      return a.name.localeCompare(b.name);
    });

    sortedUsers.forEach((user) => {
      const userItem = document.createElement('div');
      userItem.className = `${CSS_PREFIX}__user`;

      // Color indicator
      const colorDot = document.createElement('span');
      colorDot.className = `${CSS_PREFIX}__user-color`;
      colorDot.style.backgroundColor = user.color;
      userItem.appendChild(colorDot);

      // User name
      const userName = document.createElement('span');
      userName.className = `${CSS_PREFIX}__user-name`;
      userName.textContent = user.name;
      userItem.appendChild(userName);

      // "You" badge for current user
      if (user.clientId === currentClientId) {
        const youBadge = document.createElement('span');
        youBadge.className = `${CSS_PREFIX}__you-badge`;
        youBadge.textContent = '(you)';
        userItem.appendChild(youBadge);
      }

      this.userList!.appendChild(userItem);
    });
  }

  private toggleDropdown() {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  private openDropdown() {
    if (!this.dropdown || !this.dom) return;
    this.isOpen = true;
    this.dropdown.style.display = 'block';
    this.dom.setAttribute('aria-expanded', 'true');
    this.dom.classList.add(`${CSS_PREFIX}--open`);
    this.updateUserList(); // Refresh on open
  }

  private closeDropdown() {
    if (!this.dropdown || !this.dom) return;
    this.isOpen = false;
    this.dropdown.style.display = 'none';
    this.dom.setAttribute('aria-expanded', 'false');
    this.dom.classList.remove(`${CSS_PREFIX}--open`);
  }
}
