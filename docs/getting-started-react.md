# React

This guide describes how to integrate Kerebron with your React project.

## Create a React project (optional)

Start with a fresh React project. [Vite](https://vitejs.dev/guide/) will set up everything we need.

```bash
npm create vite@latest my-kerebron-project -- --template react-ts
cd my-kerebron-project
```

## Install dependencies

```bash
npm install @kerebron/editor @kerebron/editor-kits
```

## Create an editor component

Create a new component in `src/Kerebron.tsx`:

```tsx
// src/Kerebron.tsx
import { useEditor, EditorContent } from '@kerebron/editor/react'
import { StarterKit } from '@kerebron/editor-kits/StarterKit'

const Kerebron = () => {
  const editor = useEditor({
    extensions: [new StarterKit()],
    content: '<p>Hello World!</p>',
  })

  return <EditorContent editor={editor} />
}

export default Kerebron
```

## Add it to your app

Replace the content of `src/App.tsx` with your new `Kerebron` component:

```tsx
import Kerebron from './Kerebron'

const App = () => {
  return <Kerebron />
}

export default App
```

You should now see a working editor in your browser when you run `npm run dev`.

## Next steps

- [Configure your editor](./configure.md)
- [Add styles to your editor](./style-editor.md)
- [Check the full React example](../examples/browser-react/)
