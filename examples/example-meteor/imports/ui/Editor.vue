<script setup>
import * as random from 'lib0/random';
import * as Y from 'yjs';

import {CoreEditor} from "@kerebron/editor";
import {ExtensionBasicEditor} from "@kerebron/extension-basic-editor";
import {ExtensionMarkdown} from '@kerebron/extension-markdown';
import {ExtensionTables} from '@kerebron/extension-tables';
import {ExtensionMenu} from "@kerebron/extension-menu";
import {ExtensionYjs} from "@kerebron/extension-yjs";
import {NodeCodeMirror} from "@kerebron/extension-codemirror";

import { MeteorProvider } from './y-meteor.ts';

import { onMounted } from 'vue';

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
  const meteorProvider = new MeteorProvider(roomId, ydoc);

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
      new ExtensionMenu(),
      new ExtensionMarkdown(),
      new ExtensionTables(),
      new ExtensionYjs({ ydoc, provider: meteorProvider }),
      new NodeCodeMirror({ ydoc, provider: meteorProvider }),
      // new NodeCodeMirror(),
    ]
  });

  // editor.setDocument(innerHTML, 'text/html');
  editor.setDocument(innerHTML);
});
</script>

<template>
  <h2 class="text-xl my-6 font-semibold">Editor</h2>
  <div id="editor">Some text</div>
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
