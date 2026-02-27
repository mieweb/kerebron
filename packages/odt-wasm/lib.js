let wasmInstance;

export async function init(wasmBinary) {
  const internal = await import('./lib/odt_parser.internal.js');
  const wasm = await WebAssembly.instantiate(wasmBinary, {
    './odt_parser.internal.js': internal,
  });

  internal.__wbg_set_wasm(wasm.instance.exports);
  wasm.instance.exports.__wbindgen_start();
  internal.init_debug();

  wasmInstance = wasm.instance;
  return internal;
}
