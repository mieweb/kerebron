<template>
  <h2>YJS demo</h2>
  <a href="/editor-yjs">New doc</a>
  <ul>
    <li v-for="id in roomIDs"><a :href="'/editor-yjs#room:'+id">{{ id }}</a></li>
  </ul>

  <h2>YJS codemirror demo</h2>
  <a href="/editor-code">New doc</a>
  <ul>
    <li v-for="id in roomIDs"><a :href="'/editor-code#room:'+id">{{ id }}</a></li>
  </ul>

<!--  <h2>Automerge demo</h2>
  <a href="/editor-am">New doc</a>
  <ul>
    <li v-for="id in docs"><a :href="'/editor-yjs#automerge:'+id">{{ id }}</a></li>
  </ul>-->
</template>

<script>
export default {
  data() {
    return {
      roomIDs: [],
      docs: []
    }
  },
  created() {
    this.fetch();
  },
  methods: {
    async fetch() {
      const response = await fetch('/api/rooms');
      this.roomIDs = await response.json();
      const response2 = await fetch('/api/docs');
      this.docs = await response2.json();
    }
  }
};
</script>
