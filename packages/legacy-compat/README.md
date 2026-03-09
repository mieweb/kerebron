# Compatibility layer for loading directly from browsers and old bundlers

## Using Kerebron directly from CDN.

Packages from NPM can be directly accessed using https://cdn.jsdelivr.net.

This package has all editor modules combined and uploaded to CDN.

Exported methods are in `./mod.ts`

Wasm assets from package `@kerebron/wasm` can be accessed from path:

https://cdn.jsdelivr.net/npm/@kerebron/wasm@latest/assets (no trailing slash to avoid 400 error).

Usage:

```html
<button id="loadOdt">LOAD ODT</button>
<div id="editor"></div>
<style>
    @import "https://cdn.jsdelivr.net/npm/@kerebron/legacy-compat@latest/dist/kerebron.css";
/* For light only mode
    @import "https://cdn.jsdelivr.net/npm/@kerebron/legacy-compat@latest/dist/kerebron-light.css";
*/
</style>
<script type="module" defer>
    import * as Kerebron from "https://cdn.jsdelivr.net/npm/@kerebron/legacy-compat@latest/dist/kerebron.js";
    const { CoreEditor, AdvancedEditorKit, createAssetLoad } = Kerebron;

    const editor = CoreEditor.create({
        uri: "test.odt",
        assetLoad: createAssetLoad('https://cdn.jsdelivr.net/npm/@kerebron/wasm@latest/assets'),
        element: document.getElementById("editor"),
        editorKits: [new AdvancedEditorKit()],
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

## Using Kerebron directly from old bundlers which do not undestand export paths.

```html
<script type="module" defer>
    import * as Kerebron from "@kerebron/legacy-compat";
    const { CoreEditor, AdvancedEditorKit, createAssetLoad } = Kerebron;

    const editor = CoreEditor.create({
        uri: "test.odt",
        assetLoad: createAssetLoad('/wasm'), // Serve @kerebron/wasm assets under this path
        element: document.getElementById("editor"),
        editorKits: [new AdvancedEditorKit()],
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

## Development

### Building

```sh
deno task -f legacy-compat build
```

### Testing before npm publish

Use `index-dev.html` file to check if it's loading correctly.
It is the same as example above except that istead of using npm it is using
npm package from http://localhost:8000/dist

```sh
deno task -f legacy-compat serve
```

1. Go to: http://localhost:8000/index-dev.html
2. Check if wasm is working correctly. Eg. open `.odt` file.
