export interface DecorationInline {
  startIndex: number;
  endIndex: number;
  className: string;
  title?: string;
}

export class Decorator {
  public decorationGroups: Record<string, DecorationInline[]> = {};

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
        if (decor.title) {
          html += `<span class="${decor.className}" title="${
            escapeHtml(decor.title || '')
          }">`;
        } else {
          html += `<span class="${decor.className}">`;
        }
      }

      html += escapeHtml(text);

      for (const decor of activeDecors) {
        html += '</span>';
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
