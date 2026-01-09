<template>
  <button @click="newRoom">New room</button>
  <ul>
    <li v-for="id in roomIDs">
      <a :href="'#room:' + id">{{ id }}</a>
    </li>
  </ul>

  <EditorYjs />
</template>

<script>
import EditorYjs from './components/EditorYjs.vue';

export default {
  name: 'App',
  components: {
    EditorYjs
  },
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
