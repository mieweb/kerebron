# Getting Started with Vue 3

This guide shows you how to integrate Kerebron into a Vue 3 application using the Composition API and Options API.

## Installation

```bash
npm install @kerebron/editor @kerebron/extension-basic-editor @kerebron/extension-menu @kerebron/extension-markdown @kerebron/editor-kits
```

### Optional Extensions

```bash
npm install @kerebron/extension-tables      # Table support
npm install @kerebron/extension-codemirror  # Code blocks with syntax highlighting
```

## Basic Component (Composition API)

Create a simple editor component using Vue 3's Composition API:

```vue
<!-- components/Editor.vue -->
<template>
  <div>
    <div ref="editorRef" class="kb-component"></div>
    
    <!-- Optional: Markdown preview -->
    <div v-if="showPreview" style="margin-top: 20px;">
      <h3>Markdown Output</h3>
      <pre style="background: #f5f5f5; padding: 10px;">{{ markdown }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

const editorRef = ref<HTMLElement>();
const markdown = ref('');
const showPreview = ref(true);
let editor: CoreEditor | null = null;

onMounted(async () => {
  if (!editorRef.value) return;

  // Initialize editor
  editor = new CoreEditor({
    element: editorRef.value,
    extensions: [new AdvancedEditorKit()],
  });

  // Listen for changes
  const onTransaction = async () => {
    if (!editor) return;
    const buffer = await editor.saveDocument('text/x-markdown');
    markdown.value = new TextDecoder().decode(buffer);
  };

  editor.addEventListener('transaction', onTransaction);

  // Load initial content
  const content = '# Welcome\n\nStart editing here...';
  const buffer = new TextEncoder().encode(content);
  await editor.loadDocument('text/x-markdown', buffer);
});

onUnmounted(() => {
  editor?.destroy();
});
</script>

<style scoped>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-menu/assets/custom-menu.css';
@import '@kerebron/extension-tables/assets/tables.css';
</style>
```

## Advanced Component with Props

Create a reusable component that accepts props and exposes methods:

```vue
<!-- components/KerebronEditor.vue -->
<template>
  <div ref="editorRef" class="kb-component"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

interface Props {
  initialContent?: string;
  modelValue?: string;
}

const props = withDefaults(defineProps<Props>(), {
  initialContent: '',
  modelValue: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'ready': [editor: CoreEditor];
}>();

const editorRef = ref<HTMLElement>();
let editor: CoreEditor | null = null;

// Expose methods to parent
defineExpose({
  getMarkdown: async (): Promise<string> => {
    if (!editor) return '';
    const buffer = await editor.saveDocument('text/x-markdown');
    return new TextDecoder().decode(buffer);
  },
  loadMarkdown: async (content: string): Promise<void> => {
    if (!editor) return;
    const buffer = new TextEncoder().encode(content);
    await editor.loadDocument('text/x-markdown', buffer);
  },
  loadFile: async (file: File): Promise<void> => {
    if (!editor) return;
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    await editor.loadDocument(
      file.type || 'application/octet-stream',
      uint8Array
    );
  },
  getEditor: (): CoreEditor | null => editor,
});

onMounted(async () => {
  if (!editorRef.value) return;

  editor = new CoreEditor({
    element: editorRef.value,
    extensions: [new AdvancedEditorKit()],
  });

  // Handle transactions
  const onTransaction = async () => {
    if (!editor) return;
    const buffer = await editor.saveDocument('text/x-markdown');
    const md = new TextDecoder().decode(buffer);
    emit('update:modelValue', md);
  };

  editor.addEventListener('transaction', onTransaction);

  // Load initial content
  const content = props.modelValue || props.initialContent;
  if (content) {
    const buffer = new TextEncoder().encode(content);
    await editor.loadDocument('text/x-markdown', buffer);
  }

  emit('ready', editor);
});

onUnmounted(() => {
  editor?.destroy();
});

// Watch for external changes to modelValue
watch(() => props.modelValue, async (newValue) => {
  if (!editor) return;
  const currentBuffer = await editor.saveDocument('text/x-markdown');
  const currentContent = new TextDecoder().decode(currentBuffer);
  
  // Only update if content actually changed (avoid loops)
  if (newValue !== currentContent) {
    const buffer = new TextEncoder().encode(newValue);
    await editor.loadDocument('text/x-markdown', buffer);
  }
});
</script>

<style scoped>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-menu/assets/custom-menu.css';
@import '@kerebron/extension-tables/assets/tables.css';
</style>
```

### Using the Advanced Component

```vue
<!-- App.vue -->
<template>
  <div class="container">
    <h1>Kerebron Editor - Vue 3</h1>
    
    <div class="toolbar">
      <button @click="loadSample">Load Sample</button>
      <button @click="loadFile">Load File</button>
      <button @click="saveMarkdown">Save Markdown</button>
    </div>

    <KerebronEditor
      ref="editorRef"
      v-model="markdown"
      initial-content="# Hello World\n\nStart editing!"
      @ready="onEditorReady"
    />

    <div class="preview">
      <h3>Live Preview</h3>
      <pre>{{ markdown }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import KerebronEditor from './components/KerebronEditor.vue';
import type { CoreEditor } from '@kerebron/editor';

const editorRef = ref<InstanceType<typeof KerebronEditor>>();
const markdown = ref('');

const onEditorReady = (editor: CoreEditor) => {
  console.log('Editor is ready!', editor);
};

const loadSample = async () => {
  await editorRef.value?.loadMarkdown('# Sample\n\nThis is a **sample** document.');
};

const loadFile = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.odt,.docx';
  input.onchange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      await editorRef.value?.loadFile(file);
    }
  };
  input.click();
};

const saveMarkdown = async () => {
  const md = await editorRef.value?.getMarkdown();
  if (md) {
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    a.click();
    URL.revokeObjectURL(url);
  }
};
</script>

<style scoped>
.container {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.toolbar {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 16px;
  cursor: pointer;
}

.preview {
  margin-top: 20px;
}

pre {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
}
</style>
```

## Options API

If you prefer the Options API, here's an equivalent component:

```vue
<!-- components/EditorOptionsAPI.vue -->
<template>
  <div>
    <div ref="editor" class="kb-component"></div>
    
    <div v-if="showPreview" style="margin-top: 20px;">
      <h3>Markdown Output</h3>
      <pre>{{ markdown }}</pre>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

export default defineComponent({
  name: 'EditorOptionsAPI',
  props: {
    initialContent: {
      type: String,
      default: '# Welcome\n\nStart editing...',
    },
    showPreview: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      editor: null as CoreEditor | null,
      markdown: '',
    };
  },
  async mounted() {
    this.editor = new CoreEditor({
      element: this.$refs.editor as HTMLElement,
      extensions: [new AdvancedEditorKit()],
    });

    // Listen for changes
    this.editor.addEventListener('transaction', async () => {
      if (!this.editor) return;
      const buffer = await this.editor.saveDocument('text/x-markdown');
      this.markdown = new TextDecoder().decode(buffer);
      this.$emit('change', this.markdown);
    });

    // Load initial content
    if (this.initialContent) {
      const buffer = new TextEncoder().encode(this.initialContent);
      await this.editor.loadDocument('text/x-markdown', buffer);
    }

    this.$emit('ready', this.editor);
  },
  beforeUnmount() {
    this.editor?.destroy();
  },
  methods: {
    async getMarkdown(): Promise<string> {
      if (!this.editor) return '';
      const buffer = await this.editor.saveDocument('text/x-markdown');
      return new TextDecoder().decode(buffer);
    },
    async loadMarkdown(content: string): Promise<void> {
      if (!this.editor) return;
      const buffer = new TextEncoder().encode(content);
      await this.editor.loadDocument('text/x-markdown', buffer);
    },
  },
});
</script>

<style scoped>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-menu/assets/custom-menu.css';
</style>
```

## Composable (Reusable Logic)

Create a composable for common editor operations:

```typescript
// composables/useKerebron.ts
import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

export function useKerebron(initialContent?: string) {
  const editorRef: Ref<HTMLElement | undefined> = ref();
  const markdown = ref('');
  const isReady = ref(false);
  let editor: CoreEditor | null = null;

  onMounted(async () => {
    if (!editorRef.value) return;

    editor = new CoreEditor({
      element: editorRef.value,
      extensions: [new AdvancedEditorKit()],
    });

    const onTransaction = async () => {
      if (!editor) return;
      const buffer = await editor.saveDocument('text/x-markdown');
      markdown.value = new TextDecoder().decode(buffer);
    };

    editor.addEventListener('transaction', onTransaction);

    if (initialContent) {
      const buffer = new TextEncoder().encode(initialContent);
      await editor.loadDocument('text/x-markdown', buffer);
    }

    isReady.value = true;
  });

  onUnmounted(() => {
    editor?.destroy();
  });

  const loadMarkdown = async (content: string) => {
    if (!editor) return;
    const buffer = new TextEncoder().encode(content);
    await editor.loadDocument('text/x-markdown', buffer);
  };

  const getEditor = () => editor;

  return {
    editorRef,
    markdown,
    isReady,
    loadMarkdown,
    getEditor,
  };
}
```

### Using the Composable

```vue
<!-- components/SimpleEditor.vue -->
<template>
  <div>
    <button @click="loadSample" :disabled="!isReady">
      Load Sample
    </button>
    
    <div ref="editorRef" class="kb-component"></div>
    
    <pre>{{ markdown }}</pre>
  </div>
</template>

<script setup lang="ts">
import { useKerebron } from '../composables/useKerebron';

const { editorRef, markdown, isReady, loadMarkdown } = useKerebron('# Initial Content');

const loadSample = () => {
  loadMarkdown('# New Content\n\nReplaced!');
};
</script>

<style>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-menu/assets/custom-menu.css';
</style>
```

## With Vite

Your `vite.config.ts` should look like:

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: [
      '@kerebron/editor',
      '@kerebron/extension-basic-editor',
      '@kerebron/extension-menu',
    ],
  },
});
```

## TypeScript Support

For better TypeScript support, create type definitions:

```typescript
// types/kerebron.d.ts
declare module '@kerebron/editor' {
  export class CoreEditor {
    constructor(config: {
      element: HTMLElement;
      extensions: any[];
      uri?: string;
      cdnUrl?: string;
    });
    loadDocument(mimeType: string, buffer: Uint8Array): Promise<void>;
    saveDocument(mimeType: string): Promise<Uint8Array>;
    addEventListener(event: string, callback: (e: any) => void): void;
    removeEventListener(event: string, callback: (e: any) => void): void;
    destroy(): void;
  }
}
```

## Global Registration (Optional)

If you want to register the editor globally:

```typescript
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import KerebronEditor from './components/KerebronEditor.vue';

// Import CSS globally
import '@kerebron/editor/assets/index.css';
import '@kerebron/extension-menu/assets/custom-menu.css';

const app = createApp(App);

// Register globally
app.component('KerebronEditor', KerebronEditor);

app.mount('#app');
```

Then use it without importing:

```vue
<template>
  <KerebronEditor v-model="markdown" />
</template>
```

## Next Steps

- **[Add Collaboration](./getting-started-collaboration.md)** - Enable real-time multi-user editing
- **[Add LSP Support](./getting-started-lsp.md)** - Get autocomplete and diagnostics
- **[Customize Menu](../packages/extension-menu/CUSTOM_MENU.md)** - Build a custom toolbar
- **[Check Examples](../examples/browser-vue/)** - See a complete Vue implementation

## Troubleshooting

### Editor Not Rendering

- Ensure CSS is imported (either globally or scoped)
- Check that the ref element exists when the editor initializes
- Verify extensions are installed

### Reactivity Issues

- Use `ref` for the editor container element
- Don't recreate the editor on re-renders
- Clean up properly in `onUnmounted`

### TypeScript Errors

- Add type definitions for Kerebron packages
- Ensure `vue-tsc` is installed for type checking
- Check that your `tsconfig.json` includes proper paths
