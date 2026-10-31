import { WSContext, WSEvents, WSMessageReceive } from 'hono/ws';

import { type ExecuteProgress, JupyterKernel } from './JupyterKernel.ts';
import { listKernelSpecs } from './kernel.ts';

/** Client → server. */
type ClientMsg = {
  id: string | number;
  op: 'list' | 'start' | 'eval' | 'execute' | 'shutdown';
  name?: string;
  code?: string;
  timeoutMs?: number;
};

/** Server → client. */
type ServerMsg =
  | { id: string | number; ok: true; result: unknown }
  | { id: string | number; ok: false; error: string }
  | { id: string | number; progress: ExecuteProgress };

/**
 * Minimal WebSocket bridge over {@link JupyterKernel}.
 * One kernel per connection (state lives in the upgrade closure).
 *
 * Protocol (JSON text frames, no JSON-RPC):
 * - `{ id, op: "list" }` → available kernelspecs
 * - `{ id, op: "start", name? }` → start kernel (default `deno`)
 * - `{ id, op: "execute", code, timeoutMs? }` → run code, stream progress
 * - `{ id, op: "eval", code, timeoutMs? }` → expression → text/plain
 * - `{ id, op: "shutdown" }` → stop kernel
 *
 * Progress (while execute runs): `{ id, progress: { type, ... } }`
 * Final reply: `{ id, ok: true, result }` or `{ id, ok: false, error }`
 */
export class JupyterWsAdapter {
  upgradeWebSocket(): WSEvents {
    let kernel: JupyterKernel | null = null;
    // Serialize requests so progress events stay ordered per connection.
    let chain: Promise<void> = Promise.resolve();

    const send = (ws: WebSocket, msg: ServerMsg) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    const ensureKernel = async (name?: string): Promise<JupyterKernel> => {
      if (kernel && !kernel.closed) {
        if (name && name !== kernel.name) {
          throw new Error(
            `kernel already running as '${kernel.name}'; shutdown first to switch`,
          );
        }
        return kernel;
      }
      kernel = await JupyterKernel.start({ name: name ?? 'deno' });
      return kernel;
    };

    const handle = async (ws: WebSocket, msg: ClientMsg) => {
      const { id, op } = msg;

      switch (op) {
        case 'list': {
          const specs = await listKernelSpecs();
          send(ws, {
            id,
            ok: true,
            result: specs.map((s) => ({
              name: s.name,
              displayName: s.displayName,
              language: s.language,
            })),
          });
          return;
        }

        case 'start': {
          const k = await ensureKernel(msg.name);
          send(ws, {
            id,
            ok: true,
            result: {
              name: k.name,
              language: k.language,
              displayName: k.displayName,
            },
          });
          return;
        }

        case 'execute': {
          if (typeof msg.code !== 'string') {
            throw new Error('execute requires string "code"');
          }
          const k = await ensureKernel();
          const result = await k.execute(
            msg.code,
            msg.timeoutMs ?? 15_000,
            (progress) => send(ws, { id, progress }),
          );
          send(ws, { id, ok: true, result });
          return;
        }

        case 'eval': {
          if (typeof msg.code !== 'string') {
            throw new Error('eval requires string "code"');
          }
          const k = await ensureKernel();
          const text = await k.eval(msg.code, msg.timeoutMs ?? 15_000);
          send(ws, { id, ok: true, result: { text } });
          return;
        }

        case 'shutdown': {
          if (kernel) {
            await kernel.shutdown();
            kernel = null;
          }
          send(ws, { id, ok: true, result: null });
          return;
        }

        default:
          throw new Error(`unknown op: ${String(op)}`);
      }
    };

    return {
      onOpen: (_evt, wsContext: WSContext) => {
        if (!wsContext.raw) return;
      },
      onError: (error, _wsContext: WSContext) => {
        console.warn(new Error('JupyterWsAdapter.onError', { cause: error }));
      },
      onMessage: (
        message: MessageEvent<WSMessageReceive>,
        wsContext: WSContext,
      ) => {
        const raw = wsContext.raw as WebSocket | null | undefined;
        if (!raw || typeof message.data !== 'string') return;
        const data = message.data;

        chain = chain.then(async () => {
          let parsed: ClientMsg;
          try {
            parsed = JSON.parse(data) as ClientMsg;
          } catch {
            send(raw, { id: 0, ok: false, error: 'invalid JSON' });
            return;
          }
          if (
            !parsed || typeof parsed !== 'object' ||
            parsed.id === undefined || parsed.id === null
          ) {
            send(raw, { id: 0, ok: false, error: 'missing id' });
            return;
          }
          try {
            await handle(raw, parsed);
          } catch (e) {
            send(raw, {
              id: parsed.id,
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        });
      },
      onClose: (_event, _wsContext: WSContext) => {
        const k = kernel;
        kernel = null;
        if (k) {
          k.shutdown().catch((e) => {
            console.warn('JupyterWsAdapter shutdown on close failed', e);
          });
        }
      },
    };
  }
}
