import type { IconSpec } from '@kerebron/ui/icons';
import type { CoreEditor } from '@kerebron/editor';

export interface MenuItem {
  type: 'item';
  id: string;
  title: string;
  label?: string;
  icon?: IconSpec | string;
  shortcut?: string;
  disabled?: boolean;
  active?: (editor: CoreEditor) => boolean;
  can?: (editor: CoreEditor) => boolean;
  action?: (editor: CoreEditor) => void;
}

export interface MenuSeparator {
  type: 'separator';
  id: string;
}

export interface MenuDropdown {
  type: 'dropdown';
  id: string;
  title: string;
  label?: string;
  icon?: IconSpec | string;
  items: MenuNode[];
  active?: (editor: CoreEditor) => boolean;
  can?: (editor: CoreEditor) => boolean;
}

export type MenuNode = MenuItem | MenuSeparator | MenuDropdown;

export interface MenuBar {
  items: MenuNode[];
  tray: MenuItem[];
}
