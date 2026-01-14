# Wasm ODT parser

## Format docs

https://en.wikipedia.org/wiki/OpenDocument_technical_specification
https://docs.libreoffice.org/schema.html
https://wiki.documentfoundation.org/Development/ODF_Implementer_Notes/List_of_LibreOffice_ODF_Extensions

https://docs.oasis-open.org/office/OpenDocument/v1.4/

## Schemas

https://git.libreoffice.org/core/+/refs/heads/master/schema/libreoffice/OpenDocument-v1.4+libreoffice-schema.rng
https://git.libreoffice.org/core/+/refs/heads/master/schema/odf1.4/OpenDocument-v1.4-schema.rng

TODO: generate structs from rng schemas

## Build

```sh
deno task wasmbuild
```

## Test

```sh
cargo run -p wasm_runner

deno -A ./main.js
```
