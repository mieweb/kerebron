import { type ChildProcess, spawn } from 'node:child_process';
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';

import type { ConnInfo, KernelSpec, KernelStartOptions } from './types.ts';

/** Jupyter kernelspec search paths (Linux + common overrides). */
export function kernelSpecDirs(): string[] {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const jupyterPath = process.env.JUPYTER_PATH;
  const dirs = [
    jupyterPath,
    home ? join(home, '.local', 'share', 'jupyter', 'kernels') : '',
    '/usr/local/share/jupyter/kernels',
    '/usr/share/jupyter/kernels',
  ].filter(Boolean) as string[];

  // JUPYTER_PATH may be colon-separated roots; each root has kernels/.
  const expanded: string[] = [];
  for (const d of dirs) {
    if (d === jupyterPath && d.includes(':')) {
      for (const root of d.split(':')) {
        if (root) expanded.push(join(root, 'kernels'));
      }
    } else if (d === jupyterPath) {
      expanded.push(join(d, 'kernels'));
    } else {
      expanded.push(d);
    }
  }
  return [...new Set(expanded)];
}

/**
 * List installed kernelspecs by scanning Jupyter data dirs.
 * Later dirs do not override earlier ones (user > system).
 */
export async function listKernelSpecs(): Promise<KernelSpec[]> {
  const byName = new Map<string, KernelSpec>();

  // Walk system first, then user, so user wins.
  const dirs = kernelSpecDirs().reverse();
  for (const dir of dirs) {
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const resourceDir = join(dir, e.name);
      const specPath = join(resourceDir, 'kernel.json');
      try {
        const raw = JSON.parse(await readFile(specPath, 'utf8'));
        const argv = raw.argv;
        if (!Array.isArray(argv) || argv.length === 0) continue;
        byName.set(e.name, {
          name: e.name,
          displayName: String(raw.display_name ?? e.name),
          language: String(raw.language ?? ''),
          argv: argv.map(String),
          env: (raw.env && typeof raw.env === 'object')
            ? Object.fromEntries(
              Object.entries(raw.env).map(([k, v]) => [k, String(v)]),
            )
            : {},
          resourceDir,
        });
      } catch {
        // skip broken specs
      }
    }
  }

  // Built-in fallback: host CLI as deno kernel if kernelspec missing.
  if (!byName.has('deno')) {
    byName.set('deno', {
      name: 'deno',
      displayName: 'Deno',
      language: 'typescript',
      argv: [
        process.execPath,
        'jupyter',
        '--kernel',
        '--conn',
        '{connection_file}',
      ],
      env: {},
      resourceDir: '',
    });
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildSpawn(
  spec: KernelSpec,
  connPath: string,
  extraEnv?: Record<string, string>,
): { cmd: string; args: string[]; env: Record<string, string> } {
  const argv = spec.argv.map((part) =>
    part.replaceAll('{connection_file}', connPath)
  );
  if (argv.length === 0) {
    throw new Error(`kernel '${spec.name}' has empty argv`);
  }
  return {
    cmd: argv[0],
    args: argv.slice(1),
    env: { ...spec.env, ...extraEnv },
  };
}

export async function getKernelSpec(name: string): Promise<KernelSpec> {
  const specs = await listKernelSpecs();
  const found = specs.find((s) => s.name === name);
  if (!found) {
    const names = specs.map((s) => s.name).join(', ') || '(none)';
    throw new Error(`unknown kernel '${name}'. available: ${names}`);
  }
  return found;
}

export function waitForExit(child: ChildProcess): Promise<number | null> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(child.exitCode);
  }
  return new Promise((resolve) => {
    child.once('exit', (code) => resolve(code));
  });
}

export function killProcess(
  child: ChildProcess,
  signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM',
): void {
  if (child.killed || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    child.kill(signal);
  } catch {
    // already dead / no permission
  }
}

/** Spawn kernel process; rejects on ENOENT / immediate spawn failure. */
function spawnKernel(
  cmd: string,
  args: string[],
  env: Record<string, string | undefined>,
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    // Keep stderr piped so the client can surface compile/runtime logs when
    // Jupyter only returns status=error / "Execution failed".
    const child = spawn(cmd, args, {
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const onError = (err: Error) => {
      child.off('spawn', onSpawn);
      reject(err);
    };
    const onSpawn = () => {
      child.off('error', onError);
      resolve(child);
    };
    child.once('error', onError);
    child.once('spawn', onSpawn);
  });
}

export type SpawnedKernel = {
  process: ChildProcess;
  connPath: string;
  /** Rolling buffer of kernel process stderr (host-side, not iopub). */
  processStderr: string[];
};

const PROCESS_STDERR_MAX_CHARS = 32_000;

/** Attach stderr collector; mutates `buf` as chunks arrive. */
export function attachProcessStderr(
  child: ChildProcess,
  buf: string[],
): void {
  const stream = child.stderr;
  if (!stream) return;
  stream.setEncoding('utf8');
  let total = 0;
  stream.on('data', (chunk: string) => {
    const text = String(chunk);
    buf.push(text);
    total += text.length;
    while (total > PROCESS_STDERR_MAX_CHARS && buf.length > 1) {
      total -= buf.shift()!.length;
    }
  });
}

export async function removeConnFile(connPath: string): Promise<void> {
  try {
    await unlink(connPath);
  } catch {
    // already gone
  }
}

export async function createKernelProcess(
  spec: KernelSpec,
  conn: ConnInfo,
  options: Pick<KernelStartOptions, 'env'> = {},
): Promise<SpawnedKernel> {
  const connPath = join(
    tmpdir(),
    `jupyter-${spec.name}-${randomUUID()}.json`,
  );
  await writeFile(connPath, JSON.stringify(conn, null, 2), 'utf8');

  try {
    const spawnInfo = buildSpawn(spec, connPath, options.env);
    // Node replaces env entirely when set — merge with host env.
    const child = await spawnKernel(spawnInfo.cmd, spawnInfo.args, {
      ...process.env,
      ...spawnInfo.env,
    });
    const processStderr: string[] = [];
    attachProcessStderr(child, processStderr);
    return { process: child, connPath, processStderr };
  } catch (err) {
    await removeConnFile(connPath);
    throw err;
  }
}
