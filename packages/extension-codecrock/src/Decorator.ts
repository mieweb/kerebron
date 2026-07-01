export interface DecorationInline {
  startIndex: number;
  endIndex: number;
  attrs: { [k: string]: string };
}

export class Decorator {
  public decorationGroups: Record<string, DecorationInline[]> = {};

  public refreshers: Array<() => void> = [];

  refresh() {
    for (const refresh of this.refreshers) {
      refresh();
    }
    this.refreshers.splice(0, this.refreshers.length);
  }

  highlight(code: string) {
    const decorations: DecorationInline[] = [];

    for (const groupName in this.decorationGroups) {
      const group = this.decorationGroups[groupName];
      decorations.push(...group);
    }

    const cutIndexes = new Set<number>();
    for (const d of decorations) {
      cutIndexes.add(d.startIndex);
      cutIndexes.add(d.endIndex);
    }
    cutIndexes.add(0);
    cutIndexes.add(code.length);

    const cutIndexesArr = Array.from(cutIndexes);
    cutIndexesArr.sort((a, b) => a - b);

    let html = '';
    let lastIndex = 0;

    for (const currentIdx of cutIndexesArr) {
      const text = code.substring(lastIndex, currentIdx);
      const activeDecors = decorations.filter((d) =>
        lastIndex >= d.startIndex && currentIdx <= d.endIndex
      );

      for (const decor of activeDecors) {
        html += `<span `;
        for (const [k, v] of Object.entries(decor.attrs || {})) {
          html += ` ${k}="${escapeHtml(v || '')}"`;
        }
        html += '>';
      }

      html += escapeHtml(text);

      for (const decor of activeDecors) {
        html += '</span>';
      }

      const activeWidgetDecors = decorations.filter((d) =>
        currentIdx === d.startIndex && d.startIndex === d.endIndex
      );
      for (const decor of activeWidgetDecors) {
        html += `<span `;
        for (const [k, v] of Object.entries(decor.attrs)) {
          html += ` ${k}="${escapeHtml(v || '')}"`;
        }
        html += '></span>';
      }

      lastIndex = currentIdx;
    }

    return html;
  }
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
