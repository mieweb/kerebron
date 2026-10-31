export type ConnInfo = {
  shell_port: number;
  iopub_port: number;
  stdin_port: number;
  control_port: number;
  hb_port: number;
  ip: string;
  key: string;
  transport: string;
  signature_scheme: string;
  kernel_name: string;
};

export type JupyterMsg = {
  header: Record<string, unknown>;
  parent_header: Record<string, unknown>;
  metadata: Record<string, unknown>;
  content: Record<string, unknown>;
};

/** Output collected from one cell execution. */
export type CellResult = {
  status: string;
  streams: string[];
  /** Combined iopub stderr + kernel process stderr. */
  stderr: string;
  results: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  text: string;
  resultText: string;
};

/** Resolved kernelspec (from Jupyter data dirs). */
export type KernelSpec = {
  name: string;
  displayName: string;
  language: string;
  argv: string[];
  env: Record<string, string>;
  resourceDir: string;
};

export type KernelStartOptions = {
  /**
   * Kernelspec name, e.g. `'deno'`, `'python3'`.
   * Default: `'deno'`.
   */
  name?: string;
  /**
   * Override spawn argv. Use `{connection_file}` placeholder.
   * When set, skips kernelspec lookup (still uses `name` for conn metadata).
   */
  argv?: string[];
  /** Extra env merged onto kernelspec env. */
  env?: Record<string, string>;
  /** How long to wait for kernel_info handshake. */
  readyTimeoutMs?: number;
};
