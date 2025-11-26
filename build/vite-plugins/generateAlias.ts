const __dirname = import.meta.dirname!;

export function generateAlias() {
  return {
    '$deno_tree_sitter': 'https://deno.land/x/deno_tree_sitter@1.0.1.2/main/',
    '@kerebron/editor/assets': __dirname + '/../../' +
      'packages/editor/assets',
    '@kerebron/extension-tables/assets': __dirname + '/../../' +
      'packages/extension-tables/assets',
    '@kerebron/extension-menu/assets': __dirname + '/../../' +
      'packages/extension-menu/assets',
    '@kerebron/extension-menu-legacy/assets': __dirname + '/../../' +
      'packages/extension-menu-legacy/assets',
    '@kerebron/extension-codemirror/assets': __dirname + '/../../' +
      'packages/extension-codemirror/assets',
    '@kerebron/extension-codejar/assets': __dirname + '/../../' +
      'packages/extension-codejar/assets',
    '@kerebron/extension-autocomplete/assets': __dirname + '/../../' +
      'packages/extension-autocomplete/assets',
    // 'punycode.js': __dirname + '/src/punycode.ts',
    // import punycode from 'punycode.js'
  };
}
