Big Ball of Mud

All editor modules combined and uploaded to CDN.

Usage:

```html
<button id="loadOdt">LOAD ODT</button>
<div id="editor"></div>
<style>
    @import "https://cdn.jsdelivr.net/npm/@kerebron/lib-cdn@latest/dist/kerebron.css";
</style>
<script type="module">
    import { CoreEditor, AdvancedEditorKit } from "https://cdn.jsdelivr.net/npm/@kerebron/lib-cdn@latest/dist/kerebron.mjs";

    window.addEventListener('load', async () => {
        const editor = new CoreEditor({
            uri: 'test.odt',
            element: document.getElementById('editor'),
            extensions: [
                new AdvancedEditorKit(),
            ],
        });

        document.getElementById('loadOdt').addEventListener('click', async () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                console.log('Selected file:', file);
                await editor.loadDocument(file.type, await file.arrayBuffer());
            });
            input.click();
            return true;
        });
    });
</script>
```
