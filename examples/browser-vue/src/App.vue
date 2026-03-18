<template>
  <my-yjs-room @change-room="setRoom" @change-user="setUser" ref="roomSelector" />
  <EditorYjs :roomId="roomId" :user="user" />
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
      if (!event.detail) {
        return;
      }
      this.user = { ...event.detail };
    }
  },
  mounted() {
    console.log(this.$refs.roomSelector);
    this.user = this.$refs.roomSelector.user;
  }
};
</script>
