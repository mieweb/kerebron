<script>
import {Mongo} from "meteor/mongo";
const collectionName = 'ephemeralChannel';
const collection = new Mongo.Collection(collectionName + 'Messages');
</script>
<script setup>
import * as random from 'lib0/random';
import * as Y from 'yjs';

import {CoreEditor, createThemeManager, createAccessibilityManager} from "@kerebron/editor";
import {ExtensionBasicEditor} from "@kerebron/extension-basic-editor";
import {ExtensionMarkdown} from '@kerebron/extension-markdown';
import {ExtensionTables} from '@kerebron/extension-tables';
import {ExtensionMenu} from "@kerebron/extension-menu";
import {ExtensionYjs} from "@kerebron/extension-yjs";
import {NodeCodeMirror} from "@kerebron/extension-codemirror";

import { MeteorProvider } from './y-meteor.ts';

import { onMounted, ref } from 'vue';

const currentTheme = ref('default');
let themeManager = null;

const handleThemeChange = () => {
  if (themeManager) {
    themeManager.setTheme(currentTheme.value);
  }
};

onMounted(() => {
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

  const userColor = usercolors[random.uint32() % usercolors.length]

  const ydoc = new Y.Doc();

  const roomId = 'room-abc';
  const meteorProvider = new MeteorProvider(roomId, ydoc, collectionName, collection);

  meteorProvider.on('status', event => {
    console.log('wsProvider status', event.status) // logs "connected" or "disconnected"
  });

  meteorProvider.awareness.setLocalStateField('user', {
    name: 'Anonymous ' + Math.floor(Math.random() * 100),
    color: userColor.color,
    colorLight: userColor.light
  });

  const element = document.getElementById('editor');
  const innerHTML = element.innerHTML;
  element.innerHTML = '';
  const editor = new CoreEditor({
    element,
    extensions: [
      new ExtensionBasicEditor(),
      new ExtensionMenu({
        floating: true,
        contextToolbar: true,
        virtualKeyboard: true,
        mobileTableControls: true,
      }),
      new ExtensionMarkdown(),
      new ExtensionTables(),
      new ExtensionYjs({ ydoc, provider: meteorProvider }),
      new NodeCodeMirror({ ydoc, provider: meteorProvider }),
      // new NodeCodeMirror(),
    ]
  });

  // Initialize theme and accessibility managers
  themeManager = createThemeManager(element);
  const accessibilityManager = createAccessibilityManager(element);
  
  // Set default theme
  themeManager.setTheme('default');

  // editor.setDocument(innerHTML, 'text/html');
  editor.setDocument(innerHTML);
});
</script>

<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h2 class="text-xl my-6 font-semibold">Kerebron Editor - Meteor Example</h2>
      
      <div style="display: flex; align-items: center; gap: 1rem;">
        <label for="theme-select" style="font-weight: 600;">Theme:</label>
        <select 
          id="theme-select"
          v-model="currentTheme" 
          @change="handleThemeChange"
          style="padding: 0.5rem; border: 1px solid var(--kb-color-border, #e5e7eb); border-radius: 4px; background: var(--kb-color-surface, white);"
        >
          <option value="default">Default</option>
          <option value="corporate">Corporate</option>
          <option value="creative">Creative</option>
          <option value="dark">Dark</option>
        </select>
      </div>
    </div>
    
    <div class="kb-editor" id="editor">Some text</div>
    
    <div style="margin-top: 1rem; padding: 1rem; background: var(--kb-color-surface-elevated, #f9fafb); border-radius: 8px; font-size: 0.875rem; color: var(--kb-color-text-muted, #6b7280);">
      <p>✨ <strong>Enhanced Features:</strong></p>
      <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
        <li>📱 Mobile-first responsive design with touch-optimized controls</li>
        <li>🎨 Dynamic theming with 6 built-in presets</li>
        <li>♿ WCAG 2.1 AA accessibility compliance</li>
        <li>⌨️ Full keyboard navigation and shortcuts</li>
        <li>🖱️ Context-sensitive formatting toolbar</li>
        <li>📏 48px minimum touch targets for better usability</li>
      </ul>
    </div>
  </div>
</template>
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
</style>
