import { AnyExtensionOrReq, Extension } from '@kerebron/editor';
import { NodeCodeMirror, NodeCodeMirrorConfig } from './NodeCodeMirror.ts';

export * from './NodeCodeMirror.ts';

export interface ExtensionCodeMirrorConfig {
  languageWhitelist?: NodeCodeMirrorConfig['languageWhitelist'];
  theme?: NodeCodeMirrorConfig['theme'];
  readOnly?: boolean;
}

export class ExtensionCodeMirror extends Extension {
  override name = 'code-mirror';
  requires: AnyExtensionOrReq[];

  constructor(public override config: ExtensionCodeMirrorConfig) {
    super(config);

    this.requires = [
      new NodeCodeMirror({
        languageWhitelist: config.languageWhitelist,
        theme: config.theme,
      }),
    ];
  }
}
