# Kerebron Mobile-First Integration Guide

This guide shows how to integrate Kerebron with all the new mobile-friendly features, theming system, and accessibility enhancements.

## Basic Setup

### 1. Install and Import

```javascript
import { 
  CoreEditor,
  createThemeManager,
  createAccessibilityManager 
} from '@kerebron/editor';
import { ExtensionMenu } from '@kerebron/extension-menu';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';

// Import the complete stylesheet
import '@kerebron/editor/src/styles/index.css';
```

### 2. Create Editor with Mobile Features

```javascript
// Create editor element
const editorElement = document.getElementById('editor');

// Initialize the editor with mobile-optimized menu
const editor = new CoreEditor({
  element: editorElement,
  extensions: [
    new ExtensionBasicEditor(),
    new ExtensionMenu({
      floating: true,
      contextToolbar: true,        // Shows formatting toolbar on text selection
      virtualKeyboard: true,       // Handles mobile virtual keyboard
      mobileTableControls: true,   // Mobile-friendly table editing
    }),
    // ... other extensions
  ],
});

// Set up theming
const themeManager = createThemeManager(editorElement);

// Set up accessibility
const accessibilityManager = createAccessibilityManager(editorElement, {
  highContrast: true,
  reducedMotion: true,
  focusManagement: true,
  announcements: true,
});
```

## Complete React Example

```jsx
import React, { useEffect, useRef, useState } from 'react';
import { 
  CoreEditor,
  createThemeManager,
  createAccessibilityManager,
  detectSystemTheme,
  watchSystemTheme 
} from '@kerebron/editor';
import { ExtensionMenu } from '@kerebron/extension-menu';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import '@kerebron/editor/src/styles/index.css';

function KerebronEditor({ content, onChange, theme = 'auto' }) {
  const editorRef = useRef(null);
  const [editor, setEditor] = useState(null);
  const [themeManager, setThemeManager] = useState(null);
  const [accessibilityManager, setAccessibilityManager] = useState(null);
  const [currentTheme, setCurrentTheme] = useState('default');

  useEffect(() => {
    if (!editorRef.current) return;

    // Initialize editor
    const editorInstance = new CoreEditor({
      element: editorRef.current,
      extensions: [
        new ExtensionBasicEditor(),
        new ExtensionMenu({
          floating: true,
          contextToolbar: {
            showOnSelection: true,
          },
          virtualKeyboard: {
            enabled: true,
            minHeightReduction: 150,
          },
          mobileTableControls: {
            enabled: true,
          },
        }),
      ],
    });

    // Set initial content
    if (content) {
      editorInstance.setDocument(content);
    }

    // Listen for changes
    editorInstance.addEventListener('transaction', (event) => {
      if (onChange) {
        onChange(editorInstance.getDocument());
      }
    });

    // Initialize theme manager
    const themeMgr = createThemeManager(editorRef.current);
    
    // Initialize accessibility manager
    const a11yMgr = createAccessibilityManager(editorRef.current);

    setEditor(editorInstance);
    setThemeManager(themeMgr);
    setAccessibilityManager(a11yMgr);

    return () => {
      editorInstance.destroy();
      a11yMgr.destroy();
    };
  }, []);

  useEffect(() => {
    if (!themeManager) return;

    if (theme === 'auto') {
      // Auto theme switching
      const systemTheme = detectSystemTheme();
      const initialTheme = systemTheme === 'dark' ? 'dark' : 'default';
      themeManager.setTheme(initialTheme);
      setCurrentTheme(initialTheme);

      const unwatch = watchSystemTheme((newTheme) => {
        const themeToApply = newTheme === 'dark' ? 'dark' : 'default';
        themeManager.setTheme(themeToApply);
        setCurrentTheme(themeToApply);
      });

      return unwatch;
    } else {
      themeManager.setTheme(theme);
      setCurrentTheme(theme);
    }
  }, [themeManager, theme]);

  return (
    <div className="kerebron-wrapper">
      {/* Skip link for keyboard users */}
      <a href="#editor" className="kb-skip-link">
        Skip to editor
      </a>
      
      {/* Theme indicator */}
      <div className="theme-indicator" style={{ 
        padding: '0.5rem', 
        background: 'var(--kb-color-surface-elevated)', 
        borderRadius: '4px',
        marginBottom: '1rem',
        fontSize: '0.875rem',
        color: 'var(--kb-color-text-muted)'
      }}>
        Current theme: {currentTheme}
      </div>

      {/* Editor */}
      <div 
        ref={editorRef} 
        id="editor"
        className="kb-editor"
        style={{ minHeight: '200px' }}
      />
    </div>
  );
}

export default KerebronEditor;
```

## Complete Vue Example

```vue
<template>
  <div class="kerebron-wrapper">
    <!-- Skip link for keyboard users -->
    <a href="#editor" class="kb-skip-link">
      Skip to editor
    </a>

    <!-- Theme selector -->
    <div class="controls" :style="controlsStyle">
      <label for="theme-select">Theme:</label>
      <select 
        id="theme-select"
        v-model="selectedTheme" 
        @change="handleThemeChange"
        :style="selectStyle"
      >
        <option value="default">Default Blue</option>
        <option value="corporate">Corporate</option>
        <option value="creative">Creative Purple</option>
        <option value="forest">Forest Green</option>
        <option value="dark">Dark Mode</option>
        <option value="midnight">Midnight</option>
      </select>

      <button 
        @click="toggleAutoTheme" 
        :style="{ 
          ...buttonStyle,
          background: autoTheme ? 'var(--kb-color-primary)' : 'var(--kb-color-surface)',
          color: autoTheme ? 'white' : 'var(--kb-color-text)'
        }"
      >
        {{ autoTheme ? '🌙 Auto' : '☀️ Manual' }}
      </button>
    </div>

    <!-- Editor -->
    <div 
      ref="editor" 
      id="editor"
      class="kb-editor"
      :style="{ minHeight: '300px' }"
    />

    <!-- Accessibility status -->
    <div class="a11y-status" :style="statusStyle">
      <p>✅ WCAG 2.1 AA Compliant</p>
      <p>🎯 Touch targets: 48px minimum</p>
      <p>⌨️ Full keyboard navigation</p>
      <p>📱 Mobile optimized</p>
    </div>
  </div>
</template>

<script>
import { 
  CoreEditor,
  createThemeManager,
  createAccessibilityManager,
  detectSystemTheme,
  watchSystemTheme 
} from '@kerebron/editor';
import { ExtensionMenu } from '@kerebron/extension-menu';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';

export default {
  name: 'KerebronEditor',
  props: {
    content: String,
    theme: {
      type: String,
      default: 'default'
    }
  },
  data() {
    return {
      editor: null,
      themeManager: null,
      accessibilityManager: null,
      selectedTheme: 'default',
      autoTheme: false,
      systemThemeWatcher: null,
    };
  },
  computed: {
    controlsStyle() {
      return {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        background: 'var(--kb-color-surface-elevated, #f9fafb)',
        borderRadius: '8px',
        marginBottom: '1rem',
      };
    },
    selectStyle() {
      return {
        padding: '0.5rem',
        border: '1px solid var(--kb-color-border, #e5e7eb)',
        borderRadius: '4px',
        background: 'var(--kb-color-surface, white)',
        color: 'var(--kb-color-text, #1f2937)',
      };
    },
    buttonStyle() {
      return {
        padding: '0.5rem 1rem',
        border: '1px solid var(--kb-color-border, #e5e7eb)',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      };
    },
    statusStyle() {
      return {
        marginTop: '1rem',
        padding: '1rem',
        background: 'var(--kb-color-surface-elevated, #f9fafb)',
        borderRadius: '8px',
        fontSize: '0.875rem',
        color: 'var(--kb-color-text-muted, #6b7280)',
      };
    },
  },
  async mounted() {
    // Initialize editor
    this.editor = new CoreEditor({
      element: this.$refs.editor,
      extensions: [
        new ExtensionBasicEditor(),
        new ExtensionMenu({
          floating: true,
          contextToolbar: true,
          virtualKeyboard: true,
          mobileTableControls: true,
        }),
      ],
    });

    // Set initial content
    if (this.content) {
      this.editor.setDocument(this.content);
    }

    // Listen for changes
    this.editor.addEventListener('transaction', (event) => {
      this.$emit('update:content', this.editor.getDocument());
    });

    // Initialize theme manager
    this.themeManager = createThemeManager(this.$refs.editor);
    
    // Initialize accessibility manager
    this.accessibilityManager = createAccessibilityManager(this.$refs.editor, {
      announcements: true,
    });

    // Set initial theme
    this.selectedTheme = this.theme;
    this.handleThemeChange();

    // Announce to screen readers
    this.accessibilityManager.announce('Rich text editor loaded and ready for input');
  },
  methods: {
    handleThemeChange() {
      if (this.themeManager) {
        this.themeManager.setTheme(this.selectedTheme);
        this.$emit('theme-changed', this.selectedTheme);
      }
    },
    toggleAutoTheme() {
      this.autoTheme = !this.autoTheme;
      
      if (this.autoTheme) {
        // Start watching system theme
        this.systemThemeWatcher = watchSystemTheme((theme) => {
          this.selectedTheme = theme === 'dark' ? 'dark' : 'default';
          this.handleThemeChange();
        });
        
        // Apply current system theme
        const systemTheme = detectSystemTheme();
        this.selectedTheme = systemTheme === 'dark' ? 'dark' : 'default';
        this.handleThemeChange();
      } else {
        // Stop watching system theme
        if (this.systemThemeWatcher) {
          this.systemThemeWatcher();
          this.systemThemeWatcher = null;
        }
      }
    },
  },
  beforeUnmount() {
    if (this.editor) {
      this.editor.destroy();
    }
    if (this.accessibilityManager) {
      this.accessibilityManager.destroy();
    }
    if (this.systemThemeWatcher) {
      this.systemThemeWatcher();
    }
  },
};
</script>
```

## Advanced Configuration

### Custom Theme with Accessibility Validation

```javascript
import { createThemeManager, validateThemeAccessibility } from '@kerebron/editor';

const customTheme = {
  colors: {
    primary: '#ff6b35',
    primaryHover: '#e55a2b',
    text: '#2d3748',
    textMuted: '#718096',
    surface: '#ffffff',
    surfaceElevated: '#f7fafc',
    border: '#e2e8f0',
  }
};

// Validate accessibility before applying
const validation = validateThemeAccessibility(customTheme.colors);
if (validation.errors.length > 0) {
  console.error('Theme accessibility errors:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.warn('Theme accessibility warnings:', validation.warnings);
}

// Apply theme
const themeManager = createThemeManager();
themeManager.setTheme(customTheme);
```

### Advanced Menu Configuration

```javascript
new ExtensionMenu({
  floating: true,
  contextToolbar: {
    showOnSelection: true,
    items: [
      // Custom formatting items
      new MenuItem({
        title: 'Highlight',
        icon: { text: '🖍️' },
        run: () => editor.chain().toggleHighlight().run(),
        active: (state) => state.doc.rangeHasMark(state.selection.from, state.selection.to, schema.marks.highlight),
      }),
    ],
    position: (view, dom) => {
      // Custom positioning logic
      const coords = view.coordsAtPos(view.state.selection.from);
      return {
        top: coords.top - dom.offsetHeight - 8,
        left: coords.left,
      };
    },
  },
  virtualKeyboard: {
    enabled: true,
    keyboardVisibleClass: 'editor-keyboard-open',
    minHeightReduction: 200,
  },
  mobileTableControls: {
    enabled: window.innerWidth < 768,
  },
})
```

### Accessibility Features

```javascript
const accessibilityManager = createAccessibilityManager(editorElement, {
  highContrast: true,      // Auto-detect high contrast mode
  reducedMotion: true,     // Respect motion preferences
  focusManagement: true,   // Enhanced focus indicators
  announcements: true,     // Screen reader announcements
});

// Manual announcements
accessibilityManager.announce('Document saved successfully');
accessibilityManager.announce('Error: Please check your input', 'assertive');

// Show keyboard shortcuts help
const shortcuts = AccessibilityManager.generateKeyboardShortcutsHelp();
console.log(shortcuts);
```

## Best Practices

### 1. Progressive Enhancement

```javascript
// Start with basic functionality
const basicEditor = new CoreEditor({
  element: editorElement,
  extensions: [new ExtensionBasicEditor()],
});

// Add enhanced features based on device capabilities
if (window.innerWidth < 768) {
  // Mobile-specific enhancements
  basicEditor.addExtension(new ExtensionMenu({
    contextToolbar: true,
    virtualKeyboard: true,
    mobileTableControls: true,
  }));
}

if ('matchMedia' in window) {
  // Theme switching for devices that support it
  const themeManager = createThemeManager();
  // ... theme logic
}
```

### 2. Performance Optimization

```javascript
// Lazy load heavy features
const editor = new CoreEditor({
  element: editorElement,
  extensions: [
    new ExtensionBasicEditor(),
    // Load menu only when needed
    window.innerWidth > 768 
      ? new ExtensionMenu({ floating: true })
      : new ExtensionMenu({ floating: false, mobileTableControls: true }),
  ],
});

// Debounce theme changes
let themeChangeTimeout;
function changeTheme(newTheme) {
  clearTimeout(themeChangeTimeout);
  themeChangeTimeout = setTimeout(() => {
    themeManager.setTheme(newTheme);
  }, 100);
}
```

### 3. Error Handling

```javascript
try {
  const editor = new CoreEditor({
    element: editorElement,
    extensions: [
      new ExtensionBasicEditor(),
      new ExtensionMenu(),
    ],
  });
  
  const themeManager = createThemeManager();
  const accessibilityManager = createAccessibilityManager(editorElement);
  
} catch (error) {
  console.error('Failed to initialize editor:', error);
  
  // Fallback to basic textarea
  const fallback = document.createElement('textarea');
  fallback.placeholder = 'Rich text editor failed to load. You can still type here.';
  editorElement.parentNode.replaceChild(fallback, editorElement);
}
```

## Testing

### Accessibility Testing

```javascript
// Test color contrast
import { AccessibilityManager } from '@kerebron/editor';

const contrast = AccessibilityManager.checkColorContrast('#333333', '#ffffff');
console.log('Contrast ratio:', contrast.ratio);
console.log('Passes WCAG AA:', contrast.passes.normal);

// Test keyboard navigation
// Use tools like axe-core for automated testing
// Use manual testing with keyboard and screen readers
```

### Mobile Testing

```javascript
// Test on different viewport sizes
function testMobileLayout() {
  const viewports = [
    { width: 375, height: 667 },  // iPhone SE
    { width: 414, height: 896 },  // iPhone 11
    { width: 768, height: 1024 }, // iPad
  ];
  
  viewports.forEach(viewport => {
    // Resize and test
    window.resizeTo(viewport.width, viewport.height);
    // Test touch targets, menu behavior, etc.
  });
}
```

This integration guide demonstrates how to use all the new features together for a comprehensive, mobile-friendly, accessible editor experience.