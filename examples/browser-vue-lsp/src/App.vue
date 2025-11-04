<template>
  <h2>YJS + Vue + CustomElement demo</h2>
  <button @click="newRoom">New room</button>
  <ul>
    <li v-for="id in roomIDs">
      <a :href="'#room:' + id">{{ id }}</a>
    </li>
  </ul>

  <my-editor v-if="roomId" ref="editor" :roomId="roomId"></my-editor>
</template>

<script>
import { defineCustomElement, h, onMounted, ref } from 'vue';
import MyEditor from './my-editor.ce.vue';

if (!customElements.get('my-editor')) {
  customElements.define('my-editor', defineCustomElement(MyEditor));
}

export default {
  name: 'App',
  data() {
    return {
      roomId: null,
      roomIDs: [],
      docs: [],
    };
  },
  created() {
    this.fetch();
    const docUrl = globalThis.location.hash.slice(1);
    if (docUrl.startsWith('room:')) {
      this.roomId = docUrl.substring('room:'.length);
    } else {
      this.roomId = null;
    }
  },
  watch: {
    $route() {
      const docUrl = globalThis.location.hash.slice(1);
      if (docUrl.startsWith('room:')) {
        this.roomId = docUrl.substring('room:'.length);
      } else {
        this.roomId = null;
      }
    }
  },
  methods: {
    async fetch() {
      const response = await fetch('/api/rooms');
      this.roomIDs = await response.json();
    },
    newRoom() {
      const roomId = String(Math.random());
      globalThis.location.hash = 'room:' + roomId;
      this.roomId = roomId;
      this.fetch();
    }
  },
};
</script>
<style>
@import '@kerebron/editor/assets/vars.css';
</style>
