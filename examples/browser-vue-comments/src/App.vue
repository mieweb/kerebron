<template>
  <div class="row">
    <div class="col" id="editor">
      <my-yjs-room @change-room="setRoom" @change-user="setUser" ref="roomSelector" />
      <EditorYjs :roomId="roomId" :user="user" ref="editor" />
    </div>
    <div class="col-3">
      <button class="btn btn-sm btn-primary" @click="addComment">Add comment</button>
      <ul>
        <li v-for="comment in comments">
          {{ comment.msg }}
        </li>
      </ul>

      <button class="btn btn-sm btn-primary" @click="addSnapshot">Add snapshot</button>
      <ul>
        <li v-for="(snapshot, idx) in snapshots">
          snapshot {{ idx }} <button @click="showSnapshot(idx)">Show</button>
        </li>
      </ul>
    </div>
  </div>

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
      user: null,
      comments: [],
      snapshots: []
    };
  },
  methods: {
    setRoom(event) {
      if (!event.detail) {
        return;
      }
      this.roomId = event.detail;
    },
    addComment() {
      const msg = prompt('Comment message').trim();
      if (!msg) {
        return;
      }
      const id = String(Math.random());

      this.$refs.editor.addComment(id);
      this.comments.push({
        id, msg
      })
    },
    async addSnapshot() {
      const snapshot = await this.$refs.editor.addSnapshot();
      this.snapshots.push(
        snapshot
      );
    },
    showSnapshot(idx) {
      const prevSnapshot = this.snapshots[idx - 1];
      const snapshot = this.snapshots[idx];
      this.$refs.editor.showSnapshot(snapshot, prevSnapshot);
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
