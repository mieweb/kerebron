<script>
import { Mongo } from 'meteor/mongo';
const collectionName = 'ephemeralChannel';
const collection = new Mongo.Collection(collectionName + 'Messages');
</script>
<script setup>
import * as random from 'lib0/random';
import * as Y from 'yjs';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionMenu } from '@kerebron/extension-menu';
import { ExtensionYjs } from '@kerebron/extension-yjs';
import { ExtensionCodeMirror } from '@kerebron/extension-codemirror';

import { MeteorProvider } from './y-meteor.ts';

import { userColors } from '@kerebron/extension-yjs/userColors';
import { dracula } from 'thememirror';

import { onMounted } from 'vue';

onMounted(async () => {
  const ydoc = new Y.Doc();

  const roomId = 'room-abc';

  const meteorProvider = new MeteorProvider(
    roomId,
    ydoc,
    collectionName,
    collection,
  );

  meteorProvider.on('status', (event) => {
    console.log('wsProvider status', event.status); // logs "connected" or "disconnected"
  });

  const userColor = userColors[random.uint32() % userColors.length];
  meteorProvider.awareness.setLocalStateField('user', {
    name: 'Anonymous ' + Math.floor(Math.random() * 100),
    color: userColor.color,
    colorLight: userColor.light,
  });

  const element = document.getElementById('editor');
  const innerHTML = element.innerHTML;
  element.innerHTML = '';
  const editor = CoreEditor.create({
    element,
    editorKits: [
      {
        getExtensions() {
          return [
            new ExtensionBasicEditor(),
            new ExtensionMenu({
              floating: true,
            }),
            new ExtensionMarkdown(),
            new ExtensionTables(),
            new ExtensionYjs({ydoc, provider: meteorProvider}),
            new ExtensionCodeMirror({theme: [dracula]}),
          ];
        }
      }
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
