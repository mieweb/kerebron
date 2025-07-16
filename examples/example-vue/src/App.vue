<template>
  <router-view />
</template>

<script>
import {defineCustomElement, onMounted, ref, h} from 'vue'
import MyEditor from './components/my-editor.ce.vue';

// customElements.define('my-editor', defineCustomElement(MyEditor));

customElements.define('my-editor', defineCustomElement({
  setup() {
    const component = ref(null);

    onMounted(() => {
      const hostNode = component.value?.$root.$host;
      if (hostNode) {
        // https://github.com/vuejs/core/issues/13632
        for (const k of MyEditor.expose) {
          if (hostNode[k]) {
            continue;
          }
          hostNode[k] = component.value[k];
        }
        component.value.$.shadowRoot = hostNode.shadowRoot;
      }
    });

    return { component };
  },
  render: () => h(MyEditor, { ref: 'component' })
}));

export default {
  name: 'App'
};
</script>
<style>
@import "@kerebron/editor/assets/vars.css";
</style>
