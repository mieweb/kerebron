import { Extension } from '@kerebron/editor';
import { NodeCodeCrock } from './NodeCodeCrock.ts';

export * from './NodeCodeCrock.ts';

export interface ExtensionCodeCrockConfig {
  readOnly?: boolean;
  languageWhitelist?: string[];
}

export class ExtensionCodeCrock extends Extension {
  override name = 'code-crock';

  nodeCodeCrock = new NodeCodeCrock({});
  requires = [
    this.nodeCodeCrock,
  ];

  constructor(public override config: ExtensionCodeCrockConfig = {}) {
    super(config);
  }

  override created(): void {
    this.nodeCodeCrock.config.languageWhitelist = this.config.languageWhitelist;
    // theme: config.theme,
  }
}
