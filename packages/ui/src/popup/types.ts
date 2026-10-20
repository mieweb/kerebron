export interface PopupOptions {
  layer: 'toplayer' | 'overlayer';
  anchorId?: string;
  anscestor?: KerebronPopup;
  id?: string;
  className?: string;
  group?: 'menu' | 'caret' | 'hover' | 'diag' | 'dialog' | string;
  backdrop?: boolean;
}

export type KerebronPopup = HTMLElement & {
  setAnchorId(id: string): void;
  addDescendant(popup: KerebronPopup): void;
  keydownHandler?: (event: KeyboardEvent) => boolean;
};
