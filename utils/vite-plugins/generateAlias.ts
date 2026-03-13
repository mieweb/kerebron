const __dirname = import.meta.dirname!;

export function generateAlias() {
  return {
    '@kerebron/editor/assets': __dirname + '/../../' +
      'packages/editor/assets',
    '@kerebron/editor-kits/assets': __dirname + '/../../' +
      'packages/editor-kits/assets',
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
    '@kerebron/extension-basic-editor/assets': __dirname + '/../../' +
      'packages/extension-basic-editor/assets',
  };
}
