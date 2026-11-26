import { debounce } from '@kerebron/editor/utilities';

import type { CodeCrockHistory, Position } from './CodeCrock.ts';

export type HistoryRecord = {
  html: string;
  pos: Position;
};

/** Editor state the history needs to read from and restore to. */
export interface HistoryOwner {
  isFocused(): boolean;
  save(): Position | undefined;
  restore(pos?: Position): void;
}

export function isCtrl(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey;
}

export function getKeyCode(event: KeyboardEvent): string | undefined {
  let key = event.key || event.keyCode || event.which;
  if (!key) return undefined;
  return (typeof key === 'string' ? key : String.fromCharCode(key))
    .toUpperCase();
}

export function isUndo(event: KeyboardEvent) {
  return isCtrl(event) && !event.shiftKey && getKeyCode(event) === 'Z';
}

export function isRedo(event: KeyboardEvent) {
  return isCtrl(event) && event.shiftKey && getKeyCode(event) === 'Z';
}

export function isCopy(event: KeyboardEvent) {
  return isCtrl(event) && getKeyCode(event) === 'C';
}

const maxRecords = 300;

/**
 * Local (standalone) undo/redo history of the editable code area:
 * snapshots of `innerHTML` plus the caret position.
 */
export class CodeCrockHistoryImpl implements CodeCrockHistory {
  private records: HistoryRecord[] = [];
  private at = -1;
  private recording = false;
  private debouncedRecord = debounce((event: KeyboardEvent) => {
    if (this.shouldRecord(event)) {
      this.record();
      this.recording = false;
    }
  }, 300);

  constructor(
    private readonly editor: HTMLElement,
    private readonly owner: HistoryOwner,
  ) {}

  /** Keys that do not change the content and thus must not be recorded. */
  shouldRecord(event: KeyboardEvent): boolean {
    return !isUndo(event) && !isRedo(event) &&
      event.key !== 'Meta' &&
      event.key !== 'Control' &&
      event.key !== 'Alt' &&
      !event.key.startsWith('Arrow');
  }

  /** Snapshot the current content and caret position (if focused). */
  record(): void {
    if (!this.owner.isFocused()) return;

    const html = this.editor.innerHTML;
    const pos = this.owner.save();
    if (!pos) return;

    const lastRecord = this.records[this.at];
    if (
      lastRecord &&
      lastRecord.html === html &&
      lastRecord.pos.start === pos.start &&
      lastRecord.pos.end === pos.end
    ) {
      return;
    }

    this.at++;
    this.records[this.at] = { html, pos };
    this.records.splice(this.at + 1);

    if (this.at > maxRecords) {
      this.at = maxRecords;
      this.records.splice(0, 1);
    }
  }

  handleKeydown(event: KeyboardEvent): void {
    this.undoRedo(event);
    if (this.shouldRecord(event) && !this.recording) {
      this.record();
      this.recording = true;
    }
  }

  handleKeyup(event: KeyboardEvent): void {
    this.debouncedRecord(event);
  }

  private undoRedo(event: KeyboardEvent): void {
    if (isUndo(event)) {
      event.preventDefault();
      this.at--;
      this.applyRecord(this.records[this.at]);
      if (this.at < 0) this.at = 0;
    }
    if (isRedo(event)) {
      event.preventDefault();
      this.at++;
      this.applyRecord(this.records[this.at]);
      if (this.at >= this.records.length) this.at--;
    }
  }

  private applyRecord(record: HistoryRecord | undefined): void {
    if (!record) return;
    this.editor.innerHTML = record.html;
    this.owner.restore(record.pos);
  }
}
