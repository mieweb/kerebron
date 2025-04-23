import * as cmState from '@codemirror/state'; // eslint-disable-line

import { Node } from 'prosemirror-model';

import * as awarenessProtocol from 'y-protocols/awareness';

export class YSyncConfig {
  constructor(
    public getNode: () => Node,
    public getPmPos: boolean | (() => number),
    public awareness: awarenessProtocol.Awareness,
  ) {
  }
}

export const ySyncFacet: cmState.Facet<YSyncConfig, YSyncConfig> = cmState.Facet
  .define({
    combine(inputs) {
      return inputs[inputs.length - 1];
    },
  });
