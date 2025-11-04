import * as cmState from '@codemirror/state';

import { Node } from 'prosemirror-model';
import type { CoreEditor } from '@kerebron/editor';

export class RemoteSyncConfig {
  constructor(
    public getNode: () => Node,
    public getPmPos: () => number | undefined,
    public editor: CoreEditor,
  ) {
  }
}

export const remoteSyncFacet: cmState.Facet<
  RemoteSyncConfig,
  RemoteSyncConfig
> = cmState.Facet
  .define({
    combine(inputs) {
      return inputs[inputs.length - 1];
    },
  });
