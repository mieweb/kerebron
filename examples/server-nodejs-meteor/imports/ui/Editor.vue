<script>
import { Mongo } from 'meteor/mongo';
const collectionName = 'ephemeralChannel';
const collection = new Mongo.Collection(collectionName + 'Messages');
</script>
<script setup>
import * as Y from 'yjs';

import { onMounted } from 'vue';

import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

import { MeteorProvider } from './y-meteor.ts';

onMounted(async () => {
  const ydoc = new Y.Doc();

  // TODO refactor to changeRoom, changeUser
  const roomId = 'room-abc';

  const meteorProvider = new MeteorProvider(
    roomId,
    ydoc,
    collectionName,
    collection,
  );

  meteorProvider.addEventListener('status', (event) => {
    console.log('wsProvider status', event.detail.status); // logs "connected" or "disconnected"
  });

  const element = document.getElementById('editor');
  const innerHTML = element.innerHTML;
  element.innerHTML = '';
  const editor = CoreEditor.create({
    element,
    editorKits: [
      new AdvancedEditorKit()
    ]
  });

  const buffer = new TextEncoder().encode(innerHTML);
  await editor.loadDocument("text/html", buffer);
});
</script>

<template>
  <div>
    <div class="kb-component" id="editor">Some text</div>
  </div>
</template>
<style>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-tables/assets/tables.css';
@import '@kerebron/extension-menu/assets/menu.css';
@import '@kerebron/extension-codemirror/assets/codemirror.css';
</style>
