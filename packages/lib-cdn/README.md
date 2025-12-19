Big Ball of Mud

All editor modules combined and uploaded to CDN.

Usage:

```html
<button id="loadOdt">LOAD ODT</button>
<div id="editor"></div>
<style>
    @import "https://cdn.jsdelivr.net/npm/@kerebron/lib-cdn@latest/dist/kerebron.css";
</style>
<script type="module" defer>
    import * as Kerebron from "https://cdn.jsdelivr.net/npm/@kerebron/lib-cdn@latest/dist/kerebron.js";
    const { CoreEditor, AdvancedEditorKit } = Kerebron;

    const editor = new CoreEditor({
        uri: "test.odt",
        element: document.getElementById("editor"),
        extensions: [new AdvancedEditorKit()],
    });

    document
        .getElementById("loadOdt")
        .addEventListener("click", async () => {
            const input = document.createElement("input");
            input.type = "file";
            input.addEventListener("change", async (e) => {
                const file = e.target.files[0];
                console.log("Selected file:", file);
                await editor.loadDocument(
                    file.type,
                    new Uint8Array(await file.arrayBuffer()),
                );
            });
            input.click();
            return true;
        });
</script>
```
