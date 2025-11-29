<template>
  <div class="app-container" :class="{ 'light-mode': isLightMode }">
    <!-- Compact toolbar - Line 1: Title, Name, Theme toggle -->
    <div class="toolbar-row">
      <span class="app-title">YJS + Vue</span>
      <div class="toolbar-group">
        <input v-model="userName" placeholder="Your name" class="compact-input name-input" @blur="saveUserName" @keyup.enter="$event.target.blur()" />
        <button @click="randomizeName" class="icon-btn" title="Random name">🎲</button>
      </div>
      <div class="toolbar-group">
        <span class="label">Room:</span>
        <code class="room-id">{{ roomId }}</code>
        <button @click="copyRoomLink" class="icon-btn" :title="copied ? 'Copied!' : 'Copy link'">{{ copied ? '✓' : '📋' }}</button>
      </div>
      <div class="toolbar-group">
        <button @click="newRoom" class="compact-btn">New</button>
        <input v-model="joinRoomInput" placeholder="Join room..." class="compact-input room-input" @keyup.enter="joinRoom" />
        <button @click="joinRoom" :disabled="!joinRoomInput.trim()" class="compact-btn">Join</button>
      </div>
      <div class="toolbar-group toolbar-right">
        <details class="rooms-dropdown">
          <summary class="icon-btn" title="Recent rooms">📁 {{ roomIDs.length }}</summary>
          <ul class="rooms-list">
            <li v-for="id in roomIDs" :key="id" :class="{ active: id === roomId }">
              <a :href="'#room:' + id" @click="switchRoom(id, $event)">{{ id }}</a>
            </li>
          </ul>
        </details>
        <button 
          @click="toggleTheme" 
          @dblclick="resetThemeToSystem"
          class="icon-btn theme-btn" 
          :class="{ 'has-override': themeOverride }"
          :title="themeOverride ? `${isLightMode ? 'Light' : 'Dark'} mode (override). Double-click to follow system.` : `Following system (${isLightMode ? 'light' : 'dark'}). Click to override.`"
        >
          {{ isLightMode ? '🌙' : '☀️' }}<span v-if="themeOverride" class="override-dot">•</span>
        </button>
      </div>
    </div>

    <EditorYjs :key="roomId" :roomId="roomId" :userName="userName" @connected="onConnected" @disconnected="onDisconnected" />
  </div>
</template>

<script>
import EditorYjs from './components/EditorYjs.vue';

// Generate human-readable room names
const adjectives = ['red', 'blue', 'green', 'happy', 'swift', 'calm', 'bright', 'cool', 'warm', 'wild'];
const nouns = ['fox', 'owl', 'bear', 'wolf', 'hawk', 'deer', 'lion', 'tiger', 'eagle', 'whale'];

function generateRoomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}-${noun}-${num}`;
}

// Generate random user names
const nameAdjectives = ['Happy', 'Clever', 'Swift', 'Brave', 'Gentle', 'Mighty', 'Silent', 'Curious', 'Friendly', 'Wise'];
const nameNouns = ['Panda', 'Phoenix', 'Dragon', 'Unicorn', 'Dolphin', 'Falcon', 'Wizard', 'Knight', 'Ninja', 'Pirate'];

function generateUserName() {
  const adj = nameAdjectives[Math.floor(Math.random() * nameAdjectives.length)];
  const noun = nameNouns[Math.floor(Math.random() * nameNouns.length)];
  return `${adj} ${noun}`;
}

const USER_NAME_KEY = 'kerebron-user-name';
const THEME_KEY = 'kerebron-theme';

export default {
  name: 'App',
  components: {
    EditorYjs
  },
  data() {
    return {
      roomId: null,
      roomIDs: [],
      joinRoomInput: '',
      copied: false,
      userName: generateUserName(), // Always start with a random name
      isLightMode: false,
      themeOverride: null, // null = follow system, 'light' or 'dark' = user override
    };
  },
  created() {
    this.loadTheme();
    this.fetch();
    this.parseRoomFromHash();
    
    // Listen for hash changes to switch rooms
    globalThis.addEventListener('hashchange', this.onHashChange);
  },
  beforeUnmount() {
    globalThis.removeEventListener('hashchange', this.onHashChange);
    globalThis.matchMedia?.('(prefers-color-scheme: light)')
      .removeEventListener('change', this.onSystemThemeChange);
  },
  methods: {
    parseRoomFromHash() {
      const docUrl = globalThis.location.hash.slice(1);
      if (docUrl.startsWith('room:')) {
        this.roomId = docUrl.substring('room:'.length);
      } else {
        // Auto-create a room with a friendly name
        this.roomId = generateRoomName();
        globalThis.location.hash = 'room:' + this.roomId;
      }
    },
    onHashChange() {
      const docUrl = globalThis.location.hash.slice(1);
      if (docUrl.startsWith('room:')) {
        const newRoomId = docUrl.substring('room:'.length);
        if (newRoomId !== this.roomId) {
          this.roomId = newRoomId;
          this.fetch();
        }
      }
    },
    async fetch() {
      const response = await fetch('/api/rooms');
      this.roomIDs = await response.json();
    },
    newRoom() {
      const roomId = generateRoomName();
      globalThis.location.hash = 'room:' + roomId;
    },
    joinRoom() {
      const roomId = this.joinRoomInput.trim();
      if (roomId) {
        globalThis.location.hash = 'room:' + roomId;
        this.joinRoomInput = '';
      }
    },
    switchRoom(id, event) {
      event.preventDefault();
      globalThis.location.hash = 'room:' + id;
    },
    async copyRoomLink() {
      const url = globalThis.location.href;
      try {
        await navigator.clipboard.writeText(url);
        this.copied = true;
        setTimeout(() => { this.copied = false; }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    },
    onConnected() {
      console.log('Editor connected to room:', this.roomId);
    },
    onDisconnected() {
      console.log('Editor disconnected from room:', this.roomId);
    },
    saveUserName() {
      if (this.userName.trim()) {
        localStorage.setItem(USER_NAME_KEY, this.userName.trim());
      }
    },
    randomizeName() {
      this.userName = generateUserName();
      this.saveUserName();
    },
    loadTheme() {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        // User has explicitly set a preference
        this.isLightMode = saved === 'light';
        this.themeOverride = saved;
      } else {
        // Follow system preference
        this.isLightMode = globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
        this.themeOverride = null;
      }
      
      // Listen for system theme changes
      globalThis.matchMedia?.('(prefers-color-scheme: light)')
        .addEventListener('change', this.onSystemThemeChange);
    },
    onSystemThemeChange(e) {
      // Only follow system changes if user hasn't overridden
      if (!this.themeOverride) {
        this.isLightMode = e.matches;
      }
    },
    toggleTheme() {
      this.isLightMode = !this.isLightMode;
      this.themeOverride = this.isLightMode ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, this.themeOverride);
    },
    resetThemeToSystem() {
      localStorage.removeItem(THEME_KEY);
      this.themeOverride = null;
      this.isLightMode = globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
    },
  },
};
</script>
<style>
@import '@kerebron/editor/assets/vars.css';

/* Dark mode (default) */
.app-container {
  --kb-bg: #1a1a1a;
  --kb-surface: #2a2a2a;
  --kb-border: #444;
  --kb-text: #e8e8e8;
  --kb-text-muted: #9a9a9a;
  --kb-accent: #7dd3fc;
  background: var(--kb-bg);
  color: var(--kb-text);
  min-height: 100vh;
}

/* Light mode */
.app-container.light-mode {
  --kb-bg: #ffffff;
  --kb-surface: #f5f5f5;
  --kb-border: #d0d0d0;
  --kb-text: #1a1a1a;
  --kb-text-muted: #666666;
  --kb-accent: #0284c7;
}

/* Light mode overrides for editor components */
.app-container.light-mode .kb-component {
  background: var(--kb-bg);
  color: var(--kb-text);
}

.app-container.light-mode .ProseMirror {
  background: var(--kb-bg);
  color: var(--kb-text);
}

.app-container.light-mode .kb-menu-bar {
  background: var(--kb-surface);
  border-color: var(--kb-border);
}

.app-container.light-mode .kb-menu-bar button {
  color: var(--kb-text);
}

.app-container.light-mode .kb-menu-bar button:hover {
  background: var(--kb-bg);
}

.app-container.light-mode pre {
  background: var(--kb-surface);
  color: var(--kb-text);
}

.app-container.light-mode code {
  background: var(--kb-surface);
  color: var(--kb-text);
}

.app-container.light-mode h5 {
  color: var(--kb-text);
}

.app-container.light-mode .connection-status.connected {
  background: rgba(34, 197, 94, 0.2);
  color: #16a34a;
}

.app-container.light-mode .connection-status.connecting {
  background: rgba(234, 179, 8, 0.2);
  color: #ca8a04;
}

.app-container.light-mode .connection-status.disconnected {
  background: rgba(239, 68, 68, 0.2);
  color: #dc2626;
}

/* Compact toolbar */
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: var(--kb-surface);
  border-bottom: 1px solid var(--kb-border);
  flex-wrap: wrap;
}

.app-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--kb-text);
  white-space: nowrap;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.toolbar-right {
  margin-left: auto;
}

.label {
  font-size: 0.8rem;
  color: var(--kb-text-muted);
  white-space: nowrap;
}

.room-id {
  font-family: monospace;
  font-size: 0.8rem;
  background: var(--kb-bg);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  color: var(--kb-accent);
}

.compact-input {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--kb-border);
  border-radius: 4px;
  background: var(--kb-bg);
  color: var(--kb-text);
  font-size: 0.85rem;
}

.compact-input::placeholder {
  color: var(--kb-text-muted);
}

.name-input {
  width: 110px;
}

.room-input {
  width: 100px;
}

.compact-btn {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--kb-border);
  border-radius: 4px;
  background: var(--kb-surface);
  color: var(--kb-text);
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
}

.compact-btn:hover:not(:disabled) {
  background: var(--kb-bg);
}

.compact-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-btn {
  padding: 0.2rem 0.4rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.9rem;
  border-radius: 3px;
}

.icon-btn:hover {
  background: var(--kb-bg);
}

/* Theme toggle button */
.theme-btn {
  position: relative;
}

.theme-btn .override-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  font-size: 0.7rem;
  color: var(--kb-accent);
  line-height: 1;
}

/* Recent rooms dropdown */
.rooms-dropdown {
  position: relative;
}

.rooms-dropdown summary {
  list-style: none;
  cursor: pointer;
}

.rooms-dropdown summary::-webkit-details-marker {
  display: none;
}

.rooms-list {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--kb-surface);
  border: 1px solid var(--kb-border);
  border-radius: 4px;
  padding: 0.25rem;
  margin-top: 0.25rem;
  list-style: none;
  min-width: 140px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.app-container.light-mode .rooms-list {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.rooms-list li a {
  display: block;
  padding: 0.3rem 0.5rem;
  text-decoration: none;
  color: var(--kb-text);
  font-family: monospace;
  font-size: 0.8rem;
  border-radius: 3px;
}

.rooms-list li a:hover {
  background: var(--kb-bg);
}

.rooms-list li.active a {
  background: var(--kb-accent);
  color: var(--kb-bg);
}
</style>
