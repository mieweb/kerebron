import { Plugin } from 'prosemirror-state';

import { Extension } from '@kerebron/editor';
import { createPairingPlugin } from './PairNodesPlugin.ts';

export class ExtensionPairing extends Extension {
  name = 'pairing-nodes';

  override getProseMirrorPlugins(): Plugin[] {
    return [
      createPairingPlugin(['shortcode_inline']),
    ];
  }
}
