import { type ChildProcess } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:net';

import { Dealer, Subscriber } from 'zeromq';

import {
  guessLanguage,
  type KernelLanguageBridge,
  resolveLanguageBridge,
} from './bridges/mod.ts';
import {
  createKernelProcess,
  getKernelSpec,
  killProcess,
  removeConnFile,
  waitForExit,
} from './kernel.ts';
import type {
  CellResult,
  ConnInfo,
  JupyterMsg,
  KernelSpec,
  KernelStartOptions,
} from './types.ts';
import { stripAnsi } from './utils.ts';

export type { KernelStartOptions } from './types.ts';

/** Streaming iopub events during `execute()`. */
export type ExecuteProgress =
  | { type: 'stream'; name: string; text: string }
  | { type: 'result'; content: Record<string, unknown> }
  | { type: 'error'; content: Record<string, unknown> }
  | { type: 'status'; state: string };

const DELIM = '<IDS|MSG>';
const PROTOCOL = '5.3';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        server.close();
        reject(new Error('failed to allocate free port'));
        return;
      }
      const { port } = addr;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    server.on('error', reject);
  });
}

async function makeConnInfo(kernelName: string): Promise<ConnInfo> {
  const ports = await Promise.all([
    freePort(),
    freePort(),
    freePort(),
    freePort(),
    freePort(),
  ]);
  return {
    shell_port: ports[0],
    iopub_port: ports[1],
    stdin_port: ports[2],
    control_port: ports[3],
    hb_port: ports[4],
    ip: '127.0.0.1',
    key: crypto.randomUUID().replaceAll('-', ''),
    transport: 'tcp',
    signature_scheme: 'hmac-sha256',
    kernel_name: kernelName,
  };
}

function sign(key: string, parts: Uint8Array[]): string {
  const h = createHmac('sha256', key);
  for (const p of parts) h.update(p);
  return h.digest('hex');
}

function makeHeader(
  session: string,
  msgType: string,
): Record<string, unknown> {
  return {
    msg_id: crypto.randomUUID(),
    session,
    username: 'client',
    date: new Date().toISOString(),
    msg_type: msgType,
    version: PROTOCOL,
  };
}

function decodeJson(bytes: Uint8Array): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(bytes));
}

function parseFrames(frames: Uint8Array[]): JupyterMsg | null {
  const dec = new TextDecoder();
  let delimIdx = -1;
  for (let i = 0; i < frames.length; i++) {
    if (dec.decode(frames[i]) === DELIM) {
      delimIdx = i;
      break;
    }
  }
  if (delimIdx < 0 || frames.length < delimIdx + 6) return null;
  return {
    header: decodeJson(frames[delimIdx + 2]),
    parent_header: decodeJson(frames[delimIdx + 3]),
    metadata: decodeJson(frames[delimIdx + 4]),
    content: decodeJson(frames[delimIdx + 5]),
  };
}

async function recvMsg(
  sock: Dealer | Subscriber,
  timeoutMs: number,
): Promise<JupyterMsg> {
  return await Promise.race([
    (async () => {
      while (true) {
        const frames = await sock.receive();
        const msg = parseFrames(frames as Uint8Array[]);
        if (msg) return msg;
      }
    })(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`recv timeout after ${timeoutMs}ms`)),
        timeoutMs,
      )
    ),
  ]);
}

export class JupyterKernel {
  private process: ChildProcess;
  private connPath: string;
  private conn: ConnInfo;
  private shell: Dealer;
  private iopub: Subscriber;
  private control: Dealer;
  private session: string;
  private spec: KernelSpec;
  /** Host process stderr chunks (kernel may log compile errors here). */
  private processStderr: string[] = [];
  private _closed = false;
  private chain: Promise<unknown> = Promise.resolve();
  /** Client-side names from set() when bridge.trackSets is true. */
  private tracked = new Set<string>();

  private constructor(opts: {
    process: ChildProcess;
    connPath: string;
    conn: ConnInfo;
    shell: Dealer;
    iopub: Subscriber;
    control: Dealer;
    session: string;
    spec: KernelSpec;
    processStderr: string[];
  }) {
    this.process = opts.process;
    this.connPath = opts.connPath;
    this.conn = opts.conn;
    this.shell = opts.shell;
    this.iopub = opts.iopub;
    this.control = opts.control;
    this.session = opts.session;
    this.spec = opts.spec;
    this.processStderr = opts.processStderr ?? [];
  }

  private bridge(): KernelLanguageBridge {
    return resolveLanguageBridge(this.spec.language, this.spec.name);
  }

  private assertIdent(name: string): void {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
      throw new Error(`invalid variable name: ${name}`);
    }
  }

  get closed(): boolean {
    return this._closed;
  }

  /** Kernelspec name, e.g. `deno` / `python3`. */
  get name(): string {
    return this.spec.name;
  }

  /** Language from kernelspec / kernel_info. */
  get language(): string {
    return this.spec.language;
  }

  get displayName(): string {
    return this.spec.displayName;
  }

  /**
   * Spawn a kernel and connect ZMQ channels.
   *
   * @example
   * ```ts
   * await using k = await JupyterKernel.start({ name: 'python3' });
   * await k.execute('x = 1');
   * ```
   */
  static async start(
    options: KernelStartOptions = {},
  ): Promise<JupyterKernel> {
    const name = options.name ?? 'deno';
    const baseSpec = options.argv
      ? {
        name,
        displayName: name,
        language: guessLanguage(name),
        argv: options.argv,
        env: {},
        resourceDir: '',
      }
      : await getKernelSpec(name);

    const spec: KernelSpec = {
      ...baseSpec,
      env: { ...baseSpec.env, ...options.env },
    };

    const conn = await makeConnInfo(spec.name);

    let child: ChildProcess | undefined;
    let connPath: string | undefined;
    let shell: Dealer | undefined;
    let iopub: Subscriber | undefined;
    let control: Dealer | undefined;

    try {
      const spawned = await createKernelProcess(spec, conn, options);
      child = spawned.process;
      connPath = spawned.connPath;

      const shellSock = new Dealer();
      const iopubSock = new Subscriber();
      const controlSock = new Dealer();
      shell = shellSock;
      iopub = iopubSock;
      control = controlSock;
      const session = crypto.randomUUID();
      const readyTimeoutMs = options.readyTimeoutMs ?? 20_000;

      // Give kernel time to bind ports (python/ipykernel can be slower).
      await new Promise((r) => setTimeout(r, 800));

      const { transport, ip } = conn;
      shellSock.connect(`${transport}://${ip}:${conn.shell_port}`);
      iopubSock.connect(`${transport}://${ip}:${conn.iopub_port}`);
      iopubSock.subscribe('');
      controlSock.connect(`${transport}://${ip}:${conn.control_port}`);
      await new Promise((r) => setTimeout(r, 100));

      const kernel = new JupyterKernel({
        process: child,
        connPath,
        conn,
        shell: shellSock,
        iopub: iopubSock,
        control: controlSock,
        session,
        spec,
        processStderr: spawned.processStderr,
      });

      // Retry kernel_info until ready or timeout.
      const deadline = Date.now() + readyTimeoutMs;
      let lastErr: unknown;
      while (Date.now() < deadline) {
        try {
          const infoReq = await kernel.send('kernel_info_request', {});
          const infoReply = await recvMsg(
            shellSock,
            Math.min(5_000, deadline - Date.now()),
          );
          if (infoReply.header.msg_type !== 'kernel_info_reply') {
            throw new Error(
              `expected kernel_info_reply, got ${infoReply.header.msg_type}`,
            );
          }
          if (
            (infoReply.parent_header as { msg_id?: string }).msg_id !==
              infoReq.header.msg_id
          ) {
            throw new Error('kernel_info_reply parent mismatch');
          }
          // Prefer language reported by kernel.
          const langInfo = infoReply.content.language_info as
            | { name?: string }
            | undefined;
          if (langInfo?.name) {
            kernel.spec = { ...kernel.spec, language: langInfo.name };
          }
          // Success: ownership of child/sockets/conn file transfers to kernel.
          child = undefined;
          connPath = undefined;
          shell = undefined;
          iopub = undefined;
          control = undefined;
          return kernel;
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      throw lastErr instanceof Error
        ? lastErr
        : new Error(`kernel '${name}' not ready: ${String(lastErr)}`);
    } catch (err) {
      try {
        shell?.close();
      } catch { /* ignore */ }
      try {
        iopub?.close();
      } catch { /* ignore */ }
      try {
        control?.close();
      } catch { /* ignore */ }
      if (child) killProcess(child);
      if (connPath) await removeConnFile(connPath);
      throw err;
    }
  }

  private async send(
    msgType: string,
    content: Record<string, unknown>,
    channel: 'shell' | 'control' = 'shell',
  ): Promise<JupyterMsg> {
    const sock = channel === 'shell' ? this.shell : this.control;
    const header = makeHeader(this.session, msgType);
    const parentHeader = {};
    const metadata = {};
    const encoder = new TextEncoder();
    const headerB = encoder.encode(JSON.stringify(header));
    const parentB = encoder.encode(JSON.stringify(parentHeader));
    const metaB = encoder.encode(JSON.stringify(metadata));
    const contentB = encoder.encode(JSON.stringify(content));
    const key = this.conn.key;
    const signature = key ? sign(key, [headerB, parentB, metaB, contentB]) : '';
    const enc = new TextEncoder();

    await sock.send([
      enc.encode(DELIM),
      enc.encode(signature),
      headerB,
      parentB,
      metaB,
      contentB,
    ]);

    return {
      header,
      parent_header: parentHeader,
      metadata,
      content,
    };
  }

  private async waitForIdle(
    parentMsgId: string,
    timeoutMs: number,
    onProgress?: (event: ExecuteProgress) => void,
  ): Promise<{
    streams: string[];
    stderr: string[];
    results: Array<Record<string, unknown>>;
    errors: Array<Record<string, unknown>>;
  }> {
    const streams: string[] = [];
    const stderr: string[] = [];
    const results: Array<Record<string, unknown>> = [];
    const errors: Array<Record<string, unknown>> = [];
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const remaining = Math.max(deadline - Date.now(), 1);
      const msg = await recvMsg(this.iopub, remaining);
      const parentId = (msg.parent_header as { msg_id?: string }).msg_id;
      if (parentId && parentId !== parentMsgId) continue;

      const type = String(msg.header.msg_type);
      if (type === 'stream') {
        const chunk = String(msg.content.text ?? '');
        const name = String(msg.content.name ?? 'stdout');
        streams.push(chunk);
        if (name === 'stderr') {
          stderr.push(chunk);
        }
        onProgress?.({ type: 'stream', name, text: chunk });
      } else if (type === 'execute_result' || type === 'display_data') {
        results.push(msg.content);
        onProgress?.({ type: 'result', content: msg.content });
      } else if (type === 'error') {
        errors.push(msg.content);
        onProgress?.({ type: 'error', content: msg.content });
      } else if (type === 'status') {
        const state = String(msg.content.execution_state ?? '');
        onProgress?.({ type: 'status', state });
        if (state === 'idle') {
          return { streams, stderr, results, errors };
        }
      }
    }
    throw new Error('timed out waiting for idle status');
  }

  /**
   * Run code in the shared kernel namespace.
   * Assignments persist for later `execute()` calls on this instance.
   * Serialized: concurrent callers queue.
   */
  execute(
    code: string,
    timeoutMs = 15_000,
    onProgress?: (event: ExecuteProgress) => void,
  ): Promise<CellResult> {
    if (this._closed) {
      return Promise.reject(new Error('kernel is closed'));
    }

    const run = async (): Promise<CellResult> => {
      // Only host-stderr written during this cell (not kernel startup noise).
      const procStderrFrom = this.processStderr.length;

      const req = await this.send('execute_request', {
        code,
        silent: false,
        store_history: true,
        user_expressions: {},
        allow_stdin: false,
        stop_on_error: true,
      });

      const parentMsgId = String(req.header.msg_id);
      const outputs = await this.waitForIdle(
        parentMsgId,
        timeoutMs,
        onProgress,
      );

      // Drain shell until matching execute_reply.
      const replyDeadline = Date.now() + timeoutMs;
      let reply: JupyterMsg | undefined;
      while (Date.now() < replyDeadline) {
        const msg = await recvMsg(
          this.shell,
          Math.max(replyDeadline - Date.now(), 1),
        );
        if (msg.header.msg_type !== 'execute_reply') continue;
        const parentId = (msg.parent_header as { msg_id?: string }).msg_id;
        if (parentId && parentId !== parentMsgId) continue;
        reply = msg;
        break;
      }
      if (!reply) {
        throw new Error('timed out waiting for execute_reply');
      }

      const resultText = stripAnsi(
        outputs.results
          .map((r) => {
            const data = r.data as Record<string, string> | undefined;
            return data?.['text/plain'] ?? '';
          })
          .join(''),
      );

      const status = String(reply.content.status ?? 'error');
      const stderr = stripAnsi(
        [
          ...outputs.stderr,
          ...this.processStderr.slice(procStderrFrom),
        ].join(''),
      ).trim();

      // iopub error first; else execute_reply ename/evalue; else stderr string.
      let errors = outputs.errors;
      if (status === 'error' && errors.length === 0) {
        const ename = reply.content.ename != null
          ? String(reply.content.ename)
          : '';
        const evalue = reply.content.evalue != null
          ? String(reply.content.evalue)
          : '';
        const traceback = Array.isArray(reply.content.traceback)
          ? reply.content.traceback.map((l) => stripAnsi(String(l)))
          : [];
        if (ename || evalue || traceback.length) {
          errors = [{
            ename: ename || 'Error',
            evalue: stripAnsi(evalue),
            traceback,
          }];
        } else if (stderr) {
          errors = [{ ename: 'Error', evalue: stderr, traceback: [] }];
        }
      }

      return {
        status,
        streams: outputs.streams,
        stderr,
        results: outputs.results,
        errors,
        text: outputs.streams.join(''),
        resultText,
      };
    };

    const next = this.chain.then(run, run);
    this.chain = next.then(() => {}, () => {});
    return next;
  }

  /**
   * Evaluate expression and return its text/plain display string.
   * Not typed — for real values use `get()`.
   */
  async eval(expression: string, timeoutMs = 15_000): Promise<string> {
    const result = await this.execute(expression, timeoutMs);
    if (result.status !== 'ok' || result.errors.length > 0) {
      throw new Error(this.formatExecuteFailure('eval failed', result));
    }
    return result.resultText.trim();
  }

  private formatExecuteFailure(prefix: string, result: CellResult): string {
    const err = result.errors[0];
    if (err) {
      const ename = String(err.ename ?? 'Error');
      const evalue = String(err.evalue ?? '');
      const tb = Array.isArray(err.traceback)
        ? err.traceback.map(String).join('\n')
        : '';
      return tb
        ? `${prefix}: ${ename}: ${evalue}\n${tb}`
        : `${prefix}: ${ename}: ${evalue}`;
    }
    if (result.stderr) return `${prefix}: ${result.stderr}`;
    return `${prefix}: status ${result.status}`;
  }

  /**
   * Run expression that yields JSON text via stdout marker (avoids repr quoting).
   * `buildCode(marker)` must print `marker + jsonText`.
   */
  private async jsonFromStdout(
    buildCode: (marker: string) => string,
  ): Promise<unknown> {
    const marker = `@@JSON_${crypto.randomUUID().slice(0, 8)}@@`;
    const result = await this.execute(buildCode(marker));
    if (result.status !== 'ok' || result.errors.length > 0) {
      throw new Error(this.formatExecuteFailure('json probe failed', result));
    }
    const text = stripAnsi(result.text);
    const idx = text.lastIndexOf(marker);
    if (idx < 0) {
      throw new Error(
        `json marker missing in stdout: ${JSON.stringify(text)}`,
      );
    }
    const payload = text.slice(idx + marker.length).trim();
    return JSON.parse(payload);
  }

  /**
   * List variable names visible in the kernel session (language-bridge dependent).
   */
  async listVars(): Promise<string[]> {
    const bridge = this.bridge();
    const names = await this.jsonFromStdout((marker) =>
      bridge.listVarsCode(marker)
    );
    if (!Array.isArray(names)) {
      throw new Error(`listVars: expected array, got ${typeof names}`);
    }
    let list = names.map(String);
    if (bridge.filterNames) list = bridge.filterNames(list);
    if (bridge.trackSets) {
      list = [...new Set([...this.tracked, ...list])];
    }
    return list.sort();
  }

  /**
   * Read a variable as a **typed** JSON value (number, string, object, …).
   * Not string-only. Non-JSON values fail (or stringify via bridge).
   */
  async get<T = unknown>(name: string): Promise<T> {
    this.assertIdent(name);
    const bridge = this.bridge();
    return await this.jsonFromStdout((marker) =>
      bridge.getCode(name, marker)
    ) as T;
  }

  /**
   * Display form only (`text/plain` string). Prefer `get()` for typed data.
   */
  async getDisplay(name: string): Promise<string> {
    this.assertIdent(name);
    return await this.eval(name);
  }

  /**
   * Assign JSON-serializable value. When the bridge sets `trackSets`, the name
   * is remembered for `listVars()`.
   */
  async set(name: string, value: unknown): Promise<void> {
    this.assertIdent(name);
    const literal = JSON.stringify(value);
    if (literal === undefined) {
      throw new Error(`set(${name}): value is not JSON-serializable`);
    }
    const bridge = this.bridge();
    const code = bridge.setCode(name, literal);

    const result = await this.execute(code);
    if (result.status !== 'ok' || result.errors.length > 0) {
      const err = result.errors[0];
      throw new Error(
        err
          ? `set(${name}): ${err.ename}: ${err.evalue}`
          : `set(${name}) failed: ${result.status}`,
      );
    }
    if (bridge.trackSets) this.tracked.add(name);
  }

  /** Shut down kernel process and close sockets. Idempotent. */
  async shutdown(): Promise<void> {
    if (this._closed) return;
    this._closed = true;

    try {
      await this.send('shutdown_request', { restart: false }, 'control');
      try {
        await recvMsg(this.control, 3_000);
      } catch {
        // kernel may exit before reply
      }
    } catch {
      // ignore send failures during teardown
    }

    try {
      this.shell.close();
    } catch { /* ignore */ }
    try {
      this.iopub.close();
    } catch { /* ignore */ }
    try {
      this.control.close();
    } catch { /* ignore */ }

    killProcess(this.process);
    try {
      await Promise.race([
        waitForExit(this.process),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    } catch { /* ignore */ }

    await removeConnFile(this.connPath);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.shutdown();
  }
}
