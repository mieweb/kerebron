# Custom Menu Extension

The Custom Menu extension provides a Google Docs-style toolbar with customizable pinned items. Users can select which tools appear in the main toolbar (maximum 8) and which overflow into a dropdown menu.

## Features

- **Customizable toolbar**: Pin up to 8 frequently-used tools
- **Overflow menu**: Remaining tools appear in a dropdown menu
- **Manage modal**: Easy-to-use interface for selecting pinned tools
- **Persistent state**: Pinned preferences are saved to localStorage
- **Responsive design**: Adapts to mobile and desktop views
- **Dark mode support**: Automatic dark mode styling

## Usage

### Basic Setup

```typescript
import { CoreEditor } from '@kerebron/editor';
import { ExtensionCustomMenu } from '@kerebron/extension-menu';

const editor = new CoreEditor({
  extensions: [
    new ExtensionCustomMenu(),
    // ... other extensions
  ],
});
```

### With Custom Menu Items

You can customize which menu items are available by creating your own menu builder:

```typescript
import { CoreEditor } from '@kerebron/editor';
import { 
  ExtensionCustomMenu, 
  MenuItem, 
  Dropdown,
  icons 
} from '@kerebron/extension-menu';

const editor = new CoreEditor({
  extensions: [
    new ExtensionCustomMenu(),
    // ... other extensions
  ],
});
```

## Features

### Pinned Tools

By default, the first 8 tools are pinned to the main toolbar. Users can customize this by:

1. Clicking the three-dot overflow menu button
2. Selecting "Manage Pinned Tools"
3. Checking/unchecking tools to pin/unpin them (maximum 8 pinned)

### Overflow Menu

The overflow menu contains two sections:

1. **Unpinned tools**: Tools that aren't pinned to the main toolbar
2. **Manage Pinned Tools**: A button to open the management modal

### Management Modal

The modal displays:
- A message showing the maximum pinned limit (8)
- A list of all available tools with checkboxes
- Visual feedback when the limit is reached (unchecked items are disabled)
- A "Done" button to save and close

## Styling

The extension includes comprehensive CSS with:
- Google Docs-style toolbar appearance
- Smooth transitions and animations
- Responsive design for mobile and desktop
- Dark mode support
- High contrast mode support

To use the styles, import the CSS file:

```typescript
import '@kerebron/extension-menu/assets/custom-menu.css';
```

## API

### ExtensionCustomMenu

The main extension class.

```typescript
class ExtensionCustomMenu extends Extension {
  name: 'customMenu'
  
  getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[]
}
```

### CustomMenuPlugin

The ProseMirror plugin that manages the menu view.

```typescript
class CustomMenuPlugin extends Plugin {
  constructor(editor: CoreEditor, options: CustomMenuOptions)
}
```

### CustomMenuOptions

Configuration options for the custom menu.

```typescript
interface CustomMenuOptions {
  /// Provides the content of the menu
  content: readonly (readonly MenuElement[])[]
}
```

## Storage

Pinned tool preferences are stored in `localStorage` under the key `kb-custom-menu-pinned`. The value is a JSON array of tool IDs.

Example:
```json
["tool-0", "tool-1", "tool-5", "tool-7"]
```

## Browser Support

- Modern browsers with localStorage support
- Mobile Safari (iOS)
- Chrome/Edge/Firefox (desktop and mobile)

## Accessibility

The extension includes proper ARIA attributes:
- `aria-label` for button descriptions
- `aria-haspopup` and `aria-expanded` for dropdown menus
- `aria-disabled` for disabled items
- Keyboard navigation support (in progress)
