<template>
  <my-yjs-room @change-room="setRoom" />
  <EditorYjs :roomId="roomId" />
</template>

<script>
import EditorYjs from './EditorYjs.vue';

import YjsRoom from '@kerebron/custom-elements/YjsRoom';
YjsRoom.register();

export default {
  name: 'App',
  components: {
    EditorYjs
  },
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
