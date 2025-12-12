# Kerebron - Prosemirror based online editor kit

## Watch a Demo

<a href="https://youtube.com/shorts/OdJjhAPj-wA?feature=share" target="_blank">
  <img src="https://github.com/user-attachments/assets/b63ec84a-0ed2-4f98-920c-76f6d3215168" alt="Alt Text" width="200">
</a>

## Playground Demo

[playground](https://demo.kerebron.com) - be nice.

## Overview

Using vanilla Prosemirror modules is often impossible because of
incompatibilities.

Kerebron forks several prosemirror projects into one monorepo in order to keep
them in sync.

Project is inspired on https://tiptap.dev/, but instead of building wrapper
around a wrapper it borrows concept of extension and command manager.

It has simplified tooling (deno), fewer dependencies and resulting in lower
number of output npm modules.

**Work in progress**


## Build

### Build static examples and `.wasm` files

```sh
deno task -f @kerebron build
```

## Development

To start example server:

```sh
deno task -f server-deno-hono start
```

## Examples

TODO

### NPM packages are generated using DNT

- https://deno.com/blog/publish-esm-cjs-module-dnt - the easiest way to publish
  a hybrid npm module for ESM and CommonJS
- https://github.com/denoland/dnt
- https://gaubee.com/article/Publishing-Your-Deno-Project-as-a-Monorepo-using-dnt/

To generate npm packages

```sh
deno -A ./build/build_npm.ts
```

## Run through docker

```sh
docker build . -t editor-test
docker run -it -p 8000:8000 -v $PWD:/usr/src/app editor-test
```

## Prerequisites

Install deno

```
npm install -g deno
```

Install rust

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init.sh
chmod +x /tmp/rustup-init.sh
/tmp/rustup-init.sh -y
source "$HOME/.cargo/env"
```
