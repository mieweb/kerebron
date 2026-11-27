import type { Node as PmNode } from 'prosemirror-model';

import { getRuntimeUri } from '@kerebron/editor/uri';

export function isEmbeddedBlock(
  trigger: { node?: PmNode; uri?: string },
): boolean {
  return !!trigger.node && !!trigger.uri &&
    getRuntimeUri(trigger.node) === trigger.uri;
}
