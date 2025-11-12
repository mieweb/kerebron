import { Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';

export { LSPExtension, type LSPExtensionConfig } from './LSPExtension.ts';
export { LSPPlugin } from './plugin.ts';
export { serverCompletion, serverCompletionSource } from './completion.ts';
export { hoverTooltips } from './hover.ts';
// export { formatDocument, formatKeymap } from './formatting.ts';
// export { renameKeymap, renameSymbol } from './rename.ts';
// export {
//   nextSignature,
//   prevSignature,
//   showSignatureHelp,
//   signatureHelp,
//   signatureKeymap,
// } from './signature.ts';
// export {
//   jumpToDeclaration,
//   jumpToDefinition,
//   jumpToDefinitionKeymap,
//   jumpToImplementation,
//   jumpToTypeDefinition,
// } from './definition.ts';
export {
  closeReferencePanel,
  findReferences,
  findReferencesKeymap,
} from './references.ts';
// export { serverDiagnostics } from './diagnostics.ts';

import { serverCompletion } from './completion.ts';
import { hoverTooltips } from './hover.ts';
// import { formatKeymap } from './formatting.ts';
// import { renameKeymap } from './rename.ts';
// import { signatureHelp } from './signature.ts';
// import { jumpToDefinitionKeymap } from './definition.ts';
// import { findReferencesKeymap } from './references.ts';
// import { serverDiagnostics } from './diagnostics.ts';

export function languageServerExtensions(): readonly (
  Extension
)[] {
  return [
    serverCompletion(),
    hoverTooltips(),
    keymap.of([
      // ...formatKeymap,
      // ...renameKeymap,
      // ...jumpToDefinitionKeymap,
      // ...findReferencesKeymap,
    ]),
    // signatureHelp(),
    // serverDiagnostics(),
  ];
}
