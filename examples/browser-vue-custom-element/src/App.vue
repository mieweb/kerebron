<template>
<my-yjs-room @change-room="setRoom" @change-user="setUser" ref="roomSelector" />
  <my-editor v-if="roomId" ref="editor" :roomId="roomId" :user="user"></my-editor>
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
      roomId: null,
      user: null
    };
  },
  methods: {
    setRoom(event) {
      if (!event.detail) {
        return;
      }
      this.roomId = event.detail;
    },
    setUser(event) {
      console.log('setUser1', event.detail)
      if (!event.detail) {
        return;
      }
      this.user = { ...event.detail };
    }
  },
  mounted() {
    console.log(this.$refs.roomSelector);
    this.user = this.$refs.roomSelector.user;
  },
};
</script>
