import * as Y from 'yjs';
import { isVisible } from './utils.ts';

interface YDebugConfig {
  STRIKE: string;
  RESET: string;
  DIM: string;
  isVisible: (item: Y.Item | null) => boolean;
  renderDeleted: (text: string, item: Y.Item | null) => string;
}

const YAnsiDebugConfig: YDebugConfig = {
  STRIKE: '\x1b[9m',
  RESET: '\x1b[0m',
  DIM: '\x1b[2m',
  isVisible: () => true,
  renderDeleted(text: string, item: Y.Item | null) {
    if (item?.deleted) {
      return this.STRIKE + text + this.RESET;
    }
    return text;
  },
};

function indentText(text: string, indent: number = 0): string {
  const indentStr = '  '.repeat(indent);
  const lines = text.split('\n');
  const indentedLines = lines.map((line) => indentStr + line);

  if (indentedLines[indentedLines.length - 1] === indentStr) {
    indentedLines[indentedLines.length - 1] = '';
  }

  return indentedLines.join('\n');
}

export function debugYNode(
  node: Y.AbstractType<any>,
  config: YDebugConfig = YAnsiDebugConfig,
): string {
  const {
    STRIKE,
    RESET,
    DIM,
  } = config;

  const yDebugClient = (item: Y.Item | null) => {
    if (!item) {
      return '';
    }
    const { client, clock } = item.id;
    return `\t${DIM}[${client}:${clock}]${RESET}`;
  };

  let retVal = '';

  if (node instanceof Y.XmlText) {
    if (!config.isVisible(node._item)) {
      return '';
    }

    retVal += config.renderDeleted('XmlText', node._item) + ' {';

    retVal += yDebugClient(node._item);
    retVal += '\n';

    let text = '';

    for (let item = node._start; item; item = item.right) {
      if (!config.isVisible(item)) {
        continue;
      }

      if (item.content instanceof Y.ContentString) {
        const content = item.content?.str || '';

        text += config.renderDeleted(content, item);
        text += yDebugClient(node._item);
        text += '\n';
      } else {
        text += config.renderDeleted(
          `Unhandled debug: ${typeof item.content}`,
          item,
        );
        text += yDebugClient(node._item);
        text += '\n';
      }
    }

    retVal += indentText(text, 1);
    retVal += `}\n`;

    return retVal;
  }

  if (node instanceof Y.XmlElement) {
    if (!config.isVisible(node._item)) {
      return '';
    }

    retVal += config.renderDeleted(`<${node.nodeName}>`, node._item);
    retVal += yDebugClient(node._item);
    retVal += '\n';

    retVal += indentText(
      node.toArray()
        .map((child) => {
          return debugYNode(child, config);
        })
        .join('\n'),
      1,
    );

    retVal += config.renderDeleted(`</${node.nodeName}>`, node._item);
    return retVal;
  }

  if (node instanceof Y.XmlFragment) {
    if (!config.isVisible(node._item)) {
      return '';
    }

    retVal += config.renderDeleted(`Y.XmlFragment`, node._item);
    retVal += yDebugClient(node._item);
    retVal += '\n';

    retVal += indentText(
      node.toArray()
        .map((child) => {
          return debugYNode(child, config);
        })
        .join('\n'),
      1,
    );
    return retVal;
  }

  if (node instanceof Y.Map) {
    if (!config.isVisible(node._item)) {
      return '';
    }

    const entries = Array.from(node.entries());

    retVal += config.renderDeleted(`Y.Map(${entries.length})`, node._item);
    retVal += yDebugClient(node._item);
    retVal += '\n';

    retVal += indentText(
      entries
        .map(([key, value]: [string, any]) =>
          '- ' + key + ': ' + debugYNode(value, config)
        )
        .join('\n'),
      1,
    );
    return retVal;
  }

  if (node instanceof Y.Array) {
    if (!config.isVisible(node._item)) {
      return '';
    }

    const arr: Y.Array<any> = node;

    retVal += config.renderDeleted(`Y.Array(${arr._length})`, node._item);
    retVal += yDebugClient(node._item);
    retVal += '\n';

    retVal += indentText(
      arr
        .map((value) => '- ' + debugYNode(value, config))
        .join('\n'),
      1,
    );
    return retVal;
  }

  if ('object' !== typeof node) {
    retVal += '' + node;
    return retVal;
  }

  throw new Error('Unhandled debug class: ' + node.constructor.name);
}

export function debugYDoc(
  ydoc: Y.Doc,
  config: YDebugConfig = YAnsiDebugConfig,
): string {
  const entries = Array.from(ydoc.share.entries());
  let retVal = '';
  for (const [key, value] of entries) {
    retVal += `${key}: `;
    retVal += debugYNode(value, config);
    retVal += '\n';
  }
  return (`Y.Doc(${entries.length})\n` + indentText(retVal, 1)).trim();
}

export function debugYDocSnapshot(
  ydoc: Y.Doc,
  snapshot: Y.Snapshot,
) {
  const retVal = debugYDoc(ydoc, {
    ...YAnsiDebugConfig,
    isVisible: (item: Y.Item | null) => {
      if (!item) return true;
      return isVisible(item, snapshot);
    },
    renderDeleted(text: string) {
      return text;
    },
  });

  return ('Y.Snapshot\n' + indentText(retVal, 1)).trim();
}
