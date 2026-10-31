# Experimental support for jupyter

## Warning

https://docs.deno.com/runtime/reference/cli/jupyter/

`deno jupyter` always runs with --allow-all

## WebSocket (`/jupyter/mine`)

JSON text frames (no JSON-RPC). One kernel per connection.

```ts
// client → server
{ id: 1, op: 'list' }
{ id: 2, op: 'start', name?: 'deno' }   // optional; auto-starts on eval/execute
{ id: 3, op: 'execute', code: 'console.log(1); 1+1', timeoutMs?: 15000 }
{ id: 4, op: 'eval', code: '1+1' }      // expression → { text }
{ id: 5, op: 'shutdown' }

// server → client
{ id: 3, progress: { type: 'stream', name: 'stdout', text: '1\n' } }
{ id: 3, progress: { type: 'status', state: 'idle' } }
{ id: 3, ok: true, result: { status, streams, stderr, results, errors, text, resultText } }
{ id: 3, ok: false, error: '...' }
```
