let wasmInstance;

export async function init() {
  const wasm = await import('./lib/rs_lib.wasm');
  const internal = await import('./lib/rs_lib.internal.js');

  internal.__wbg_set_wasm(wasm);
  wasm.__wbindgen_start();
  internal.init_debug();

  wasmInstance = wasm;
  return internal;
}
