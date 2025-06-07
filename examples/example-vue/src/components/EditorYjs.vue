<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 1rem; background: var(--kb-color-surface-elevated, #f9fafb); border-radius: 8px;">
      <a href="/">← Main</a>
      
      <div style="display: flex; align-items: center; gap: 1rem;">
        <label for="theme-selector" style="font-weight: 600;">Theme:</label>
        <select 
          id="theme-selector"
          v-model="currentTheme" 
          @change="handleThemeChange"
          style="padding: 0.5rem; border: 1px solid var(--kb-color-border, #e5e7eb); border-radius: 4px; background: var(--kb-color-surface, white);"
        >
          <option value="default">Default Blue</option>
          <option value="corporate">Corporate</option>
          <option value="creative">Creative Purple</option>
          <option value="forest">Forest Green</option>
          <option value="dark">Dark Mode</option>
          <option value="midnight">Midnight</option>
        </select>
        
        <button @click="toggleAutoTheme" :style="{ 
          padding: '0.5rem 1rem', 
          border: '1px solid var(--kb-color-border, #e5e7eb)', 
          borderRadius: '4px',
          background: autoTheme ? 'var(--kb-color-primary, #3b82f6)' : 'var(--kb-color-surface, white)',
          color: autoTheme ? 'white' : 'var(--kb-color-text, #1f2937)',
          cursor: 'pointer'
        }">
          {{ autoTheme ? '🌙 Auto' : '☀️ Manual' }}
        </button>
      </div>
    </div>

    <div class="d-flex flex-row" style="height: 85vh">
      <div class="w-50" style="max-height: 100%; overflow: scroll;">
        <div v-if="editor" style="margin-bottom: 1rem;">
          <button :disabled="!editor.can().toggleStrong().run()" @click="editor.chain().toggleStrong().run()" class="demo-button">toggleStrong</button>
          <button :disabled="!editor.can().setHorizontalRule().run()" @click="editor.chain().setHorizontalRule().run()" class="demo-button">setHorizontalRule</button>
          <button :disabled="!editor.can().setHardBreak().run()" @click="editor.chain().setHardBreak().run()" class="demo-button">setHardBreak</button>
          <button :disabled="!editor.can().setCodeBlock().run()" @click="editor.chain().setCodeBlock().run()" class="demo-button">setCodeBlock</button>
          <button :disabled="!editor.can().insertTable().run()" @click="editor.chain().insertTable().run()" class="demo-button">insertTable</button>
          <button @click="loadDoc" class="demo-button">Simulate loadDoc</button>
          <button @click="loadDoc2" class="demo-button">loadDoc</button>
        </div>
        <div ref="editor" class="w-50 kb-editor"></div>
      </div>
      <div class="w-50">
        <div class="h-33">
          <div>
            <h5>Markdown</h5>
            <pre>{{md}}</pre>
          </div>
        </div>
        <div class="h-33">
          <h5>Prosemirror JSON</h5>
          <pre>{{ JSON.stringify(lastValue, null, 2) }}</pre>
        </div>
        <div class="h-33">
          <h5>ydoc</h5>
          <pre>{{ JSON.stringify(ydoc, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// import "@kerebron/extension-tables/tables.css";

import * as Y from 'yjs';
import * as random from 'lib0/random';
import { WebsocketProvider } from 'y-websocket';

import {CoreEditor, createThemeManager, detectSystemTheme, watchSystemTheme} from "@kerebron/editor";
import {ExtensionBasicEditor} from "@kerebron/extension-basic-editor";
import {ExtensionMarkdown} from '@kerebron/extension-markdown';
import {ExtensionOdt} from '@kerebron/extension-odt';
import {ExtensionTables} from '@kerebron/extension-tables';

import {ExtensionMenu} from "@kerebron/extension-menu";

import {ExtensionYjs} from "@kerebron/extension-yjs";
import {NodeCodeMirror} from "@kerebron/extension-codemirror";

export default {
  name: "EditorYjs",
  props: ['modelValue'],
  data() {
    return {
      lastValue: null,
      doc: {},
      ydoc: {},
      md: '',
      editor: null,
      themeManager: null,
      currentTheme: 'default',
      autoTheme: false,
      systemThemeWatcher: null
    }
  },
  async mounted() {
    const docUrl = globalThis.location.hash.slice(1);
    let roomId;
    if (docUrl.startsWith('room:')) {
      roomId = docUrl.substring('room:'.length);
    } else {
      roomId = String(Math.random());
      globalThis.location.hash = 'room:' + roomId;
      // this.editor.setDocument('# TEST \n\n1.  aaa\n2.  bbb', 'text/x-markdown');
      // this.editor.setDocument(pmDoc);
      // this.editor.setDocument('# TEST \n\n1.  aaa\n2.  bbb\n\n<table><tr><td>CELL</td></tr></table>', 'text/x-markdown');
      // this.editor.setDocument(null);
    }

    const pmDoc = {
      "type": "doc",
      "attrs": {
      },
      "content": [
        {
          "type": "paragraph",
          "attrs": {
          },
          "content": [
            {
              "type": "text",
              "text": "HELLO!"
            }
          ]
        }
      ]
    };

    const usercolors = [
      { color: '#30bced', light: '#30bced33' },
      { color: '#6eeb83', light: '#6eeb8333' },
      { color: '#ffbc42', light: '#ffbc4233' },
      { color: '#ecd444', light: '#ecd44433' },
      { color: '#ee6352', light: '#ee635233' },
      { color: '#9ac2c9', light: '#9ac2c933' },
      { color: '#8acb88', light: '#8acb8833' },
      { color: '#1be7ff', light: '#1be7ff33' }
    ]

// select a random color for this user
    const userColor = usercolors[random.uint32() % usercolors.length]


    const ydoc = new Y.Doc();
    this.ydoc = ydoc;

    const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
    const wsProvider = new WebsocketProvider(protocol + '//' + globalThis.location.host + '/yjs', roomId, ydoc);

    wsProvider.on('status', event => {
      console.log('wsProvider status', event.status) // logs "connected" or "disconnected"
    });

    wsProvider.awareness.setLocalStateField('user', {
      name: 'Anonymous ' + Math.floor(Math.random() * 100),
      color: userColor.color,
      colorLight: userColor.light
    });

    this.editor = new CoreEditor({
      element: this.$refs.editor,
      extensions: [
        new ExtensionBasicEditor(),
        new ExtensionMenu(),
        new ExtensionMarkdown(),
        new ExtensionOdt(),
        new ExtensionTables(),
        new ExtensionYjs({ ydoc, provider: wsProvider }),
        new NodeCodeMirror({ ydoc, provider: wsProvider }),
        // new NodeCodeMirror(),
      ],
      // content: pmDoc
    });

    // Initialize theme manager
    this.themeManager = createThemeManager();
    
    // Detect system theme preference
    const systemTheme = detectSystemTheme();
    this.currentTheme = systemTheme === 'dark' ? 'dark' : 'default';
    this.themeManager.setTheme(this.currentTheme);

    this.editor.addEventListener('transaction', (ev: CustomEvent) => {
      this.lastValue = ev.detail.transaction.doc;
      this.md = this.editor.getDocument('text/x-markdown');
      // this.$emit('input', this.lastValue);
    });
  },
  watch: {
    value(newValue) {
      if (newValue !== this.lastValue) {
        // this.state = createState(newValue, this.handle);
        // this.view.updateState(this.state);
      }
    }
  },
  methods: {
    loadDoc() {
      this.editor.setDocument('# TEST \n\n1.  aaa **bold**\n2.  bbb\n\n```js\nconsole.log("TEST")\n```\n', 'text/x-markdown');
    },
    loadDoc2() {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async e => {
        const file = e.target.files[0];
        console.log('Selected file:', file);
        this.editor.setDocument(await file.bytes(), file.type);
      };
      input.click();
    },
    handleThemeChange() {
      if (this.themeManager) {
        this.themeManager.setTheme(this.currentTheme);
      }
    },
    toggleAutoTheme() {
      this.autoTheme = !this.autoTheme;
      
      if (this.autoTheme) {
        // Start watching system theme
        this.systemThemeWatcher = watchSystemTheme((theme) => {
          this.currentTheme = theme === 'dark' ? 'dark' : 'default';
          this.handleThemeChange();
        });
        
        // Apply current system theme
        const systemTheme = detectSystemTheme();
        this.currentTheme = systemTheme === 'dark' ? 'dark' : 'default';
        this.handleThemeChange();
      } else {
        // Stop watching system theme
        if (this.systemThemeWatcher) {
          this.systemThemeWatcher();
          this.systemThemeWatcher = null;
        }
      }
    }
  },
  beforeUnmount() {
    // Clean up system theme watcher
    if (this.systemThemeWatcher) {
      this.systemThemeWatcher();
    }
  }
};
//@import "@kerebron/extension-tables/tables.css";

</script>

<style>
/* Import shared Kerebron styles */
@import "@kerebron/editor/src/styles/index.css";

/* Local utility classes */
.h-33 {
  max-height: 33%;
  overflow: scroll;
}

/* Example-specific table styling */
table {
  border: 1px solid red;
}

table th, 
table td {
  border: 1px solid red;
}

/* Demo button styling */
.demo-button {
  padding: 0.5rem 1rem;
  margin: 0.25rem;
  border: 1px solid var(--kb-color-border, #e5e7eb);
  border-radius: var(--kb-radius-sm, 4px);
  background: var(--kb-color-surface, white);
  color: var(--kb-color-text, #1f2937);
  cursor: pointer;
  font-size: var(--kb-text-sm, 14px);
  transition: all 0.2s ease;
}

.demo-button:hover {
  background: var(--kb-color-hover, rgba(59, 130, 246, 0.05));
  border-color: var(--kb-color-primary, #3b82f6);
}

.demo-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.demo-button:disabled:hover {
  background: var(--kb-color-surface, white);
  border-color: var(--kb-color-border, #e5e7eb);
}
</style>