<script>
import {Mongo} from "meteor/mongo";
const collectionName = 'ephemeralChannel';
const collection = new Mongo.Collection(collectionName + 'Messages');
</script>
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
.h-33 {
  max-height: 33%;
  overflow: scroll;
}
table {
  border: 1px solid red;
}
table th, table td {
  border: 1px solid red;
}

.ProseMirror {
  position: relative;
}

.ProseMirror {
  word-wrap: break-word;
  white-space: pre-wrap;
  -webkit-font-variant-ligatures: none;
  font-variant-ligatures: none;
}

.ProseMirror pre {
  white-space: pre-wrap;
}

.ProseMirror li {
  position: relative;
}

.ProseMirror-hideselection *::selection { background: transparent; }
.ProseMirror-hideselection *::-moz-selection { background: transparent; }
.ProseMirror-hideselection { caret-color: transparent; }

.ProseMirror-selectednode {
  outline: 2px solid #8cf;
}

/* Make sure li selections wrap around markers */

li.ProseMirror-selectednode {
  outline: none;
}

li.ProseMirror-selectednode:after {
  content: "";
  position: absolute;
  left: -32px;
  right: -2px; top: -2px; bottom: -2px;
  border: 2px solid #8cf;
  pointer-events: none;
}
.ProseMirror-textblock-dropdown {
  min-width: 3em;
}

.ProseMirror-menu {
  margin: 0 -4px;
  line-height: 1;
}

.ProseMirror-tooltip .ProseMirror-menu {
  width: -webkit-fit-content;
  width: fit-content;
  white-space: pre;
}

.ProseMirror-menuitem {
  margin-right: 3px;
  display: inline-block;
}

.ProseMirror-menuseparator {
  border-right: 1px solid #ddd;
  margin-right: 3px;
}

.ProseMirror-menu-dropdown, .ProseMirror-menu-dropdown-menu {
  font-size: 90%;
  white-space: nowrap;
}

.ProseMirror-menu-dropdown {
  vertical-align: 1px;
  cursor: pointer;
  position: relative;
  padding-right: 15px;
}

.ProseMirror-menu-dropdown-wrap {
  padding: 1px 0 1px 4px;
  display: inline-block;
  position: relative;
}

.ProseMirror-menu-dropdown:after {
  content: "";
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid currentColor;
  opacity: .6;
  position: absolute;
  right: 4px;
  top: calc(50% - 2px);
}

.ProseMirror-menu-dropdown-menu, .ProseMirror-menu-submenu {
  position: absolute;
  background: white;
  color: #666;
  border: 1px solid #aaa;
  padding: 2px;
}

.ProseMirror-menu-dropdown-menu {
  z-index: 15;
  min-width: 6em;
}

.ProseMirror-menu-dropdown-item {
  cursor: pointer;
  padding: 2px 8px 2px 4px;
}

.ProseMirror-menu-dropdown-item:hover {
  background: #f2f2f2;
}

.ProseMirror-menu-submenu-wrap {
  position: relative;
  margin-right: -4px;
}

.ProseMirror-menu-submenu-label:after {
  content: "";
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 4px solid currentColor;
  opacity: .6;
  position: absolute;
  right: 4px;
  top: calc(50% - 4px);
}

.ProseMirror-menu-submenu {
  display: none;
  min-width: 4em;
  left: 100%;
  top: -3px;
}

.ProseMirror-menu-active {
  background: #eee;
  border-radius: 4px;
}

.ProseMirror-menu-active {
  background: #eee;
  border-radius: 4px;
}

.ProseMirror-menu-disabled {
  opacity: .3;
}

.ProseMirror-menu-submenu-wrap:hover .ProseMirror-menu-submenu, .ProseMirror-menu-submenu-wrap-active .ProseMirror-menu-submenu {
  display: block;
}

.ProseMirror-menubar {
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
  position: relative;
  min-height: 1em;
  color: #666;
  padding: 1px 6px;
  top: 0; left: 0; right: 0;
  border-bottom: 1px solid silver;
  background: white;
  z-index: 10;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  overflow: visible;
}

.ProseMirror-icon {
  display: inline-block;
  line-height: .8;
  vertical-align: -2px; /* Compensate for padding */
  padding: 2px 8px;
  cursor: pointer;
}

.ProseMirror-menu-disabled.ProseMirror-icon {
  cursor: default;
}

.ProseMirror-icon svg {
  fill: currentColor;
  height: 1em;
}

.ProseMirror-icon span {
  vertical-align: text-top;
}
.ProseMirror-gapcursor {
  display: none;
  pointer-events: none;
  position: absolute;
}

.ProseMirror-gapcursor:after {
  content: "";
  display: block;
  position: absolute;
  top: -2px;
  width: 20px;
  border-top: 1px solid black;
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}

@keyframes ProseMirror-cursor-blink {
  to {
    visibility: hidden;
  }
}

.ProseMirror-focused .ProseMirror-gapcursor {
  display: block;
}
/* Add space around the hr to make clicking it easier */

.ProseMirror-example-setup-style hr {
  padding: 2px 10px;
  border: none;
  margin: 1em 0;
}

.ProseMirror-example-setup-style hr:after {
  content: "";
  display: block;
  height: 1px;
  background-color: silver;
  line-height: 2px;
}

.ProseMirror ul, .ProseMirror ol {
  padding-left: 30px;
}

.ProseMirror blockquote {
  padding-left: 1em;
  border-left: 3px solid #eee;
  margin-left: 0; margin-right: 0;
}

.ProseMirror-example-setup-style img {
  cursor: default;
}

.ProseMirror-prompt {
  background: white;
  padding: 5px 10px 5px 15px;
  border: 1px solid silver;
  position: fixed;
  border-radius: 3px;
  z-index: 11;
  box-shadow: -.5px 2px 5px rgba(0, 0, 0, .2);
}

.ProseMirror-prompt h5 {
  margin: 0;
  font-weight: normal;
  font-size: 100%;
  color: #444;
}

.ProseMirror-prompt input[type="text"],
.ProseMirror-prompt textarea {
  background: #eee;
  border: none;
  outline: none;
}

.ProseMirror-prompt input[type="text"] {
  padding: 0 4px;
}

.ProseMirror-prompt-close {
  position: absolute;
  left: 2px; top: 1px;
  color: #666;
  border: none; background: transparent; padding: 0;
}

.ProseMirror-prompt-close:after {
  content: "âœ•";
  font-size: 12px;
}

.ProseMirror-invalid {
  background: #ffc;
  border: 1px solid #cc7;
  border-radius: 4px;
  padding: 5px 10px;
  position: absolute;
  min-width: 10em;
}

.ProseMirror-prompt-buttons {
  margin-top: 5px;
  display: none;
}
#editor, .editor {
  background: white;
  color: black;
  background-clip: padding-box;
  border-radius: 4px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  padding: 5px 0;
  margin-bottom: 23px;
}

.ProseMirror p:first-child,
.ProseMirror h1:first-child,
.ProseMirror h2:first-child,
.ProseMirror h3:first-child,
.ProseMirror h4:first-child,
.ProseMirror h5:first-child,
.ProseMirror h6:first-child {
  margin-top: 10px;
}

.ProseMirror {
  padding: 4px 8px 4px 14px;
  line-height: 1.2;
  outline: none;
}

.ProseMirror p { margin-bottom: 1em }

.codeblock-select {
  position: absolute;
  right: 0;
  z-index: 100;
  opacity: 0;
  transition: all 0.3s ease;
  margin: 6px 14px;
}

.codeblock-root {
  position: relative;
}

.codeblock-root:hover .codeblock-select {
  opacity: 1;
}

/* YJS */

/* this is a rough fix for the first cursor position when the first paragraph is empty */
.ProseMirror > .ProseMirror-yjs-cursor:first-child {
  margin-top: 16px;
}
.ProseMirror p:first-child, .ProseMirror h1:first-child, .ProseMirror h2:first-child, .ProseMirror h3:first-child, .ProseMirror h4:first-child, .ProseMirror h5:first-child, .ProseMirror h6:first-child {
  margin-top: 16px
}
/* This gives the remote user caret. The colors are automatically overwritten*/
.ProseMirror-yjs-cursor {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 1px solid black;
  border-right: 1px solid black;
  border-color: orange;
  word-break: normal;
  pointer-events: none;
}
/* This renders the username above the caret */
.ProseMirror-yjs-cursor > div {
  position: absolute;
  top: -1.05em;
  left: -1px;
  font-size: 13px;
  background-color: rgb(250, 129, 0);
  font-family: serif;
  font-style: normal;
  font-weight: normal;
  line-height: normal;
  user-select: none;
  color: white;
  padding-left: 2px;
  padding-right: 2px;
  white-space: nowrap;
}
</style>
