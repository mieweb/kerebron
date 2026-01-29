<template>
  <my-yjs-room @change-room="setRoom" />
  <my-editor v-if="roomId" ref="editor" :roomId="roomId"></my-editor>
</template>

<script>
import { defineCustomElement, h, onMounted, ref } from 'vue';

import MyEditor from './my-editor.ce.vue';
if (!customElements.get('my-editor')) {
  customElements.define('my-editor', defineCustomElement(MyEditor));
}

import YjsRoom from '@kerebron/custom-elements/YjsRoom';
YjsRoom.register();

export default {
  name: 'App',
  data() {
    return {
      roomId: null
    };
  },
  methods: {
    setRoom(event) {
      if (!event.detail) {
        return;
      }
      this.roomId = event.detail;
    }
  },
};
</script>
