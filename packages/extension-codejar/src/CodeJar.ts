const globalWindow = window;

type Options = {
  tab: string;
  indentOn: RegExp;
  moveToNewLine: RegExp;
  spellcheck: boolean;
  catchTab: boolean;
  preserveIdent: boolean;
  addClosing: boolean;
  history: boolean;
  window: typeof window;
  autoclose: {
    open: string;
    close: string;
  };
};

type HistoryRecord = {
  html: string;
  pos: Position;
};

export type Position = {
  start: number;
  end: number;
  dir?: '->' | '<-';
};

function visit(
  editor: HTMLElement,
  visitor: (el: Node) => 'stop' | undefined,
) {
  const queue: Node[] = [];
  if (editor.firstChild) queue.push(editor.firstChild);
  let el = queue.pop();
  while (el) {
    if (visitor(el) === 'stop') break;
    if (el.nextSibling) queue.push(el.nextSibling);
    if (el.firstChild) queue.push(el.firstChild);
    el = queue.pop();
  }
}

function isCtrl(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey;
}

function isUndo(event: KeyboardEvent) {
  return isCtrl(event) && !event.shiftKey && getKeyCode(event) === 'Z';
}

function isRedo(event: KeyboardEvent) {
  return isCtrl(event) && event.shiftKey && getKeyCode(event) === 'Z';
}

function isCopy(event: KeyboardEvent) {
  return isCtrl(event) && getKeyCode(event) === 'C';
}

function getKeyCode(event: KeyboardEvent): string | undefined {
  let key = event.key || event.keyCode || event.which;
  if (!key) return undefined;
  return (typeof key === 'string' ? key : String.fromCharCode(key))
    .toUpperCase();
}

function insert(text: string) {
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  document.execCommand('insertHTML', false, text);
}

function debounce(cb: any, wait: number) {
  let timeout = 0;
  return (...args: any) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => cb(...args), wait);
  };
}

function findPadding(text: string): [string, number, number] {
  // Find beginning of previous line.
  let i = text.length - 1;
  while (i >= 0 && text[i] !== '\n') i--;
  i++;
  // Find padding of the line.
  let j = i;
  while (j < text.length && /[ \t]/.test(text[j])) j++;
  return [text.substring(i, j) || '', i, j];
}

export class CodeJar extends EventTarget {
  options: Options;
  listeners: [string, any][] = [];
  history: HistoryRecord[] = [];
  at = -1;
  onUpdateCbk: (code: string) => void | undefined = () => void 0;
  focus = false;
  prev: string | undefined; // code content prior keydown event

  constructor(
    private editor: HTMLElement,
    private highlight: (e: HTMLElement, pos?: Position) => void,
    opt: Partial<Options> = {},
  ) {
    super();

    this.options = {
      tab: '\t',
      indentOn: /[({\[]$/,
      moveToNewLine: /^[)}\]]/,
      spellcheck: false,
      catchTab: true,
      preserveIdent: true,
      addClosing: true,
      history: true,
      window: globalWindow,
      autoclose: {
        open: '',
        close: '',
      },
      ...opt,
    };

    const window = this.options.window;
    const document = window.document;

    editor.setAttribute('contenteditable', 'plaintext-only');
    editor.setAttribute(
      'spellcheck',
      this.options.spellcheck ? 'true' : 'false',
    );
    editor.style.outline = 'none';
    editor.style.overflowWrap = 'break-word';
    editor.style.overflowY = 'auto';
    editor.style.whiteSpace = 'pre-wrap';

    const matchFirefoxVersion = window.navigator.userAgent.match(
      /Firefox\/([0-9]+)\./,
    );
    const firefoxVersion = matchFirefoxVersion
      ? parseInt(matchFirefoxVersion[1])
      : 0;
    let isLegacy = false; // true if plaintext-only is not supported
    if (editor.contentEditable !== 'plaintext-only' || firefoxVersion >= 136) {
      isLegacy = true;
    }
    if (isLegacy) editor.setAttribute('contenteditable', 'true');

    const debounceHighlight = debounce(() => {
      const pos = this.save();
      this.doHighlight(editor, pos);
      this.restore(pos);
    }, 30);

    let recording = false;
    const shouldRecord = (event: KeyboardEvent): boolean => {
      return !isUndo(event) && !isRedo(event) &&
        event.key !== 'Meta' &&
        event.key !== 'Control' &&
        event.key !== 'Alt' &&
        !event.key.startsWith('Arrow');
    };
    const debounceRecordHistory = debounce((event: KeyboardEvent) => {
      if (shouldRecord(event)) {
        this.recordHistory();
        recording = false;
      }
    }, 300);

    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (event: HTMLElementEventMap[K]) => void,
    ) => {
      this.listeners.push([type, fn]);
      this.editor.addEventListener(type, fn);
    };

    on('keydown', (event) => {
      if (event.defaultPrevented) return;

      this.prev = this.toString();
      if (this.options.preserveIdent) handleNewLine(event);
      else legacyNewLineFix(event);
      if (this.options.catchTab) handleTabCharacters(event);
      if (this.options.addClosing) handleSelfClosingCharacters(event);
      if (this.options.history) {
        handleUndoRedo(event);
        if (shouldRecord(event) && !recording) {
          this.recordHistory();
          recording = true;
        }
      }
      if (isLegacy && !isCopy(event)) this.restore(this.save());
    });

    on('keyup', (event) => {
      if (event.defaultPrevented) return;
      if (event.isComposing) return;

      if (this.prev !== this.toString()) debounceHighlight();
      debounceRecordHistory(event);
      this.onUpdateCbk(this.toString());
    });

    on('focus', (_event) => {
      this.focus = true;
    });

    on('blur', (_event) => {
      this.focus = false;
    });

    on('paste', (event) => {
      this.recordHistory();
      handlePaste(event);
      this.recordHistory();
      this.onUpdateCbk(this.toString());
    });

    on('cut', (event) => {
      this.recordHistory();
      handleCut(event);
      this.recordHistory();
      this.onUpdateCbk(this.toString());
    });

    const beforeCursor = () => {
      const s = this.getSelection();
      const r0 = s.getRangeAt(0);
      const r = document.createRange();
      r.selectNodeContents(editor);
      r.setEnd(r0.startContainer, r0.startOffset);
      return r.toString();
    };

    const afterCursor = () => {
      const s = this.getSelection();
      const r0 = s.getRangeAt(0);
      const r = document.createRange();
      r.selectNodeContents(editor);
      r.setStart(r0.endContainer, r0.endOffset);
      return r.toString();
    };

    const handleNewLine = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        const before = beforeCursor();
        const after = afterCursor();

        let [padding] = findPadding(before);
        let newLinePadding = padding;

        // If last symbol is "{" ident new line
        if (this.options.indentOn.test(before)) {
          newLinePadding += this.options.tab;
        }

        // Preserve padding
        if (newLinePadding.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          insert('\n' + newLinePadding);
        } else {
          legacyNewLineFix(event);
        }

        // Place adjacent "}" on next line
        if (
          newLinePadding !== padding && this.options.moveToNewLine.test(after)
        ) {
          const pos = this.save();
          insert('\n' + padding);
          this.restore(pos);
        }
      }
    };

    const legacyNewLineFix = (event: KeyboardEvent) => {
      // Firefox does not support plaintext-only mode
      // and puts <div><br></div> on Enter. Let's help.
      if (isLegacy && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (afterCursor() == '') {
          insert('\n ');
          const pos = this.save();
          pos.start = --pos.end;
          this.restore(pos);
        } else {
          insert('\n');
        }
      }
    };

    const handleSelfClosingCharacters = (event: KeyboardEvent) => {
      const open = this.options.autoclose.open;
      const close = this.options.autoclose.close;
      if (open.includes(event.key)) {
        event.preventDefault();
        const pos = this.save();
        const wrapText = pos.start == pos.end
          ? ''
          : this.getSelection().toString();
        const text = event.key + wrapText +
          (close[open.indexOf(event.key)] ?? '');
        insert(text);
        pos.start++;
        pos.end++;
        this.restore(pos);
      }
    };

    const handleTabCharacters = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) {
          const before = beforeCursor();
          let [padding, start] = findPadding(before);
          if (padding.length > 0) {
            const pos = this.save();
            // Remove full length tab or just remaining padding
            const len = Math.min(this.options.tab.length, padding.length);
            this.restore({ start, end: start + len });
            document.execCommand('delete');
            pos.start -= len;
            pos.end -= len;
            this.restore(pos);
          }
        } else {
          insert(this.options.tab);
        }
      }
    };

    const handleUndoRedo = (event: KeyboardEvent) => {
      if (isUndo(event)) {
        event.preventDefault();
        this.at--;
        const record = this.history[this.at];
        if (record) {
          editor.innerHTML = record.html;
          this.restore(record.pos);
        }
        if (this.at < 0) this.at = 0;
      }
      if (isRedo(event)) {
        event.preventDefault();
        this.at++;
        const record = this.history[this.at];
        if (record) {
          editor.innerHTML = record.html;
          this.restore(record.pos);
        }
        if (this.at >= history.length) this.at--;
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      const originalEvent = (event as any).originalEvent ?? event;
      const text = originalEvent.clipboardData.getData('text/plain').replace(
        /\r\n?/g,
        '\n',
      );
      const pos = this.save();
      insert(text);
      this.doHighlight(editor);
      this.restore({
        start: Math.min(pos.start, pos.end) + text.length,
        end: Math.min(pos.start, pos.end) + text.length,
        dir: '<-',
      });
    };

    const handleCut = (event: ClipboardEvent) => {
      const pos = this.save();
      const selection = this.getSelection();
      const originalEvent = (event as any).originalEvent ?? event;
      originalEvent.clipboardData.setData('text/plain', selection.toString());
      document.execCommand('delete');
      this.doHighlight(editor);
      this.restore({
        start: Math.min(pos.start, pos.end),
        end: Math.min(pos.start, pos.end),
        dir: '<-',
      });
      event.preventDefault();
    };
  }

  getSelection() {
    return this.editor.getRootNode().getSelection() as Selection;
  }

  private doHighlight(editor: HTMLElement, pos?: Position) {
    this.highlight(editor, pos);
  }

  private uneditable(node: Node): Element | undefined {
    while (node && node !== this.editor) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.getAttribute('contenteditable') == 'false') {
          return el;
        }
      }
      node = node.parentNode!;
    }
  }

  override toString() {
    return this.editor.textContent || '';
  }

  updateOptions(newOptions: Partial<Options>) {
    Object.assign(this.options, newOptions);
  }

  updateCode(code: string, callOnUpdate: boolean = true) {
    this.editor.textContent = code;
    this.doHighlight(this.editor);
    callOnUpdate && this.onUpdateCbk(code);
  }

  onUpdate(callback: (code: string) => void) {
    this.onUpdateCbk = callback;
  }

  save(): Position {
    const s = this.getSelection();

    const pos: Position = { start: 0, end: 0, dir: undefined };
    if (!s) {
      return pos;
    }

    let { anchorNode, anchorOffset, focusNode, focusOffset } = s;
    if (!anchorNode) throw new Error('No anchorNode');
    if (!focusNode) throw new Error('No focusNode');

    // If the anchor and focus are the editor element, return either a full
    // highlight or a start/end cursor position depending on the selection
    if (anchorNode === this.editor && focusNode === this.editor) {
      pos.start = (anchorOffset > 0 && this.editor.textContent)
        ? this.editor.textContent.length
        : 0;
      pos.end = (focusOffset > 0 && this.editor.textContent)
        ? this.editor.textContent.length
        : 0;
      pos.dir = (focusOffset >= anchorOffset) ? '->' : '<-';
      return pos;
    }

    // Selection anchor and focus are expected to be text nodes,
    // so normalize them.
    if (anchorNode.nodeType === Node.ELEMENT_NODE) {
      const node = document.createTextNode('');
      anchorNode.insertBefore(node, anchorNode.childNodes[anchorOffset]);
      anchorNode = node;
      anchorOffset = 0;
    }
    if (focusNode.nodeType === Node.ELEMENT_NODE) {
      const node = document.createTextNode('');
      focusNode.insertBefore(node, focusNode.childNodes[focusOffset]);
      focusNode = node;
      focusOffset = 0;
    }

    visit(this.editor, (el) => {
      if (el === anchorNode && el === focusNode) {
        pos.start += anchorOffset;
        pos.end += focusOffset;
        pos.dir = anchorOffset <= focusOffset ? '->' : '<-';
        return 'stop';
      }

      if (el === anchorNode) {
        pos.start += anchorOffset;
        if (!pos.dir) {
          pos.dir = '->';
        } else {
          return 'stop';
        }
      } else if (el === focusNode) {
        pos.end += focusOffset;
        if (!pos.dir) {
          pos.dir = '<-';
        } else {
          return 'stop';
        }
      }

      if (el.nodeType === Node.TEXT_NODE) {
        if (pos.dir != '->') pos.start += el.nodeValue!.length;
        if (pos.dir != '<-') pos.end += el.nodeValue!.length;
      }
    });

    this.editor.normalize(); // collapse empty text nodes
    return pos;
  }

  restore(pos: Position) {
    const s = this.getSelection();
    if (!s) {
      return;
    }

    let startNode: Node | undefined, startOffset = 0;
    let endNode: Node | undefined, endOffset = 0;

    if (!pos.dir) pos.dir = '->';
    if (pos.start < 0) pos.start = 0;
    if (pos.end < 0) pos.end = 0;

    // Flip start and end if the direction reversed
    if (pos.dir == '<-') {
      const { start, end } = pos;
      pos.start = end;
      pos.end = start;
    }

    let current = 0;

    visit(this.editor, (el) => {
      if (el.nodeType !== Node.TEXT_NODE) return;

      const len = (el.nodeValue || '').length;
      if (current + len > pos.start) {
        if (!startNode) {
          startNode = el;
          startOffset = pos.start - current;
        }
        if (current + len > pos.end) {
          endNode = el;
          endOffset = pos.end - current;
          return 'stop';
        }
      }
      current += len;
    });

    if (!startNode) {
      startNode = this.editor;
      startOffset = this.editor.childNodes.length;
    }
    if (!endNode) {
      endNode = this.editor;
      endOffset = this.editor.childNodes.length;
    }

    // Flip back the selection
    if (pos.dir == '<-') {
      [startNode, startOffset, endNode, endOffset] = [
        endNode,
        endOffset,
        startNode,
        startOffset,
      ];
    }

    {
      // If nodes not editable, create a text node.
      const startEl = this.uneditable(startNode);
      if (startEl) {
        const node = document.createTextNode('');
        startEl.parentNode?.insertBefore(node, startEl);
        startNode = node;
        startOffset = 0;
      }
      const endEl = this.uneditable(endNode);
      if (endEl) {
        const node = document.createTextNode('');
        endEl.parentNode?.insertBefore(node, endEl);
        endNode = node;
        endOffset = 0;
      }
    }

    s.setBaseAndExtent(startNode, startOffset, endNode, endOffset);
    this.editor.normalize(); // collapse empty text nodes
  }

  recordHistory() {
    if (!focus) return;

    const html = this.editor.innerHTML;
    const pos = this.save();

    const lastRecord = this.history[this.at];
    if (lastRecord) {
      if (
        lastRecord.html === html &&
        lastRecord.pos.start === pos.start &&
        lastRecord.pos.end === pos.end
      ) return;
    }

    this.at++;
    this.history[this.at] = { html, pos };
    this.history.splice(this.at + 1);

    const maxHistory = 300;
    if (this.at > maxHistory) {
      this.at = maxHistory;
      this.history.splice(0, 1);
    }
  }

  destroy() {
    for (let [type, fn] of this.listeners) {
      this.editor.removeEventListener(type, fn);
    }
  }
}
