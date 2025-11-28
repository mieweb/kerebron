# Menu extension

Custom menu system for ProseMirror editors with pinnable tools and overflow management.

## Features

- **Pinnable Tools**: Pin/unpin tools to customize the toolbar
- **Overflow Menu**: Tools that don't fit in the toolbar appear in an overflow menu
- **Mobile Responsive**: Automatically limits toolbar to 4 tools on narrow screens (< 768px)
- **State Persistence**: Pinned tool configuration saved to localStorage

## Debug Mode

Debug logging is disabled by default. To enable detailed logging for troubleshooting:

```javascript
// Enable debug mode
localStorage.setItem('kb-custom-menu-debug', 'true');

// Disable debug mode
localStorage.removeItem('kb-custom-menu-debug');
```

After changing the debug flag, refresh the page to see debug output in the console.

## Development

The custom menu plugin provides a configurable toolbar that adapts to available space and user preferences, with persistent state across sessions.
