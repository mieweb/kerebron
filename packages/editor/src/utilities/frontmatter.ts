import { YAMLMap, YamlService } from './yaml.ts';

export interface FrontmatterService {
  parse: (value: string) => unknown;
  stringify: (value: FrontmatterMap | undefined) => string;
}

class FrontmatterMap extends Map {
  origMap: YAMLMap | undefined;
  origString = '';

  constructor() {
    super();
  }
}

export class FrontmatterServiceImpl implements FrontmatterService {
  constructor(private yamlService: YamlService) {
  }

  parse(value: string) {
    const map = new FrontmatterMap();
    map.origString = value;

    const end = value.indexOf('\n---\n', 4);
    if (value.startsWith('---\n') && end > -1) {
      const origMap = this.yamlService.parse(value.substring(4, end));
      if (origMap instanceof Map) {
        map.origMap = origMap;
        for (const [k, v] of origMap) {
          map.set(k, structuredClone(v));
        }
      }
    }

    return map;
  }

  stringify(value?: FrontmatterMap) {
    if (!value) {
      return '';
    }

    if (value.origMap?.entries === value.entries) {
      // Keep original comments
      return value.origString;
    }

    const frontmatter = this.yamlService.stringify(value);
    return `---\n${frontmatter}\n---\n`;
  }
}

export class BlankFrontmatterServiceImpl implements FrontmatterService {
  constructor() {
  }

  parse(value: string) {
    return undefined;
  }

  stringify(value?: FrontmatterMap) {
    return '';
  }
}
