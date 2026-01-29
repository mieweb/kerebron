# Example for kerebron demo server

Features:

- yjs collab server
- deno
- cloudflare

## Cloudflare deploy

```sh
deno task -f browser build
deno task -f server-hono cf:deploy
```
