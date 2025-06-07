# Kerebron Theme System

The Kerebron theme system allows you to customize the appearance of the editor to match your brand and design requirements. It supports both CSS custom properties and a JavaScript API for dynamic theming.

## Quick Start

### Using Built-in Presets

```javascript
import { createThemeManager } from '@kerebron/editor';

// Create a theme manager
const themeManager = createThemeManager();

// Apply a built-in theme
themeManager.setTheme('dark');
themeManager.setTheme('corporate');
themeManager.setTheme('creative');
```

### Custom Theme Configuration

```javascript
// Define your custom theme
const customTheme = {
  colors: {
    primary: '#ff6b35',
    primaryHover: '#e55a2b',
    text: '#2d3748',
    textMuted: '#718096',
    surface: '#ffffff',
    surfaceElevated: '#f7fafc',
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
  },
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
  }
};

// Apply the custom theme
themeManager.setTheme(customTheme);
```

## Available Theme Presets

### Default Blue
Clean, modern blue theme suitable for most applications.
- Primary: `#3b82f6` (Blue 500)
- Use case: General purpose applications

### Corporate
Professional navy theme for business applications.
- Primary: `#1e40af` (Blue 800) 
- Use case: Enterprise, business, professional tools

### Creative Purple
Vibrant purple theme for creative and design applications.
- Primary: `#7c3aed` (Violet 600)
- Use case: Design tools, creative platforms

### Forest Green
Natural green theme with earthy tones.
- Primary: `#059669` (Emerald 600)
- Use case: Environmental, health, natural products

### Dark Mode
Dark theme for low-light environments.
- Primary: `#3b82f6` (Blue 500)
- Background: `#1f2937` (Gray 800)
- Use case: Night mode, developer tools

### Midnight
Ultra-dark theme with purple accents.
- Primary: `#8b5cf6` (Violet 500)
- Background: `#111827` (Gray 900)
- Use case: Gaming, entertainment, high-contrast dark mode

## Theme Configuration Options

### Colors

```typescript
interface ThemeColors {
  primary?: string;          // Primary brand color
  primaryHover?: string;     // Primary hover state
  text?: string;             // Main text color
  textMuted?: string;        // Secondary text color
  surface?: string;          // Background surface
  surfaceElevated?: string;  // Elevated surface (cards, dropdowns)
  border?: string;           // Border color
  borderStrong?: string;     // Strong border color
  success?: string;          // Success state color
  warning?: string;          // Warning state color
  error?: string;            // Error state color
}
```

### Spacing

```typescript
interface ThemeSpacing {
  xs?: string;  // 4px by default
  sm?: string;  // 8px by default
  md?: string;  // 16px by default
  lg?: string;  // 24px by default
  xl?: string;  // 32px by default
}
```

### Typography

```typescript
interface ThemeTypography {
  xs?: string;   // 12px by default
  sm?: string;   // 14px by default
  base?: string; // 16px by default
  lg?: string;   // 18px by default
}
```

### Border Radius

```typescript
interface ThemeBorderRadius {
  sm?: string;  // 4px by default
  md?: string;  // 6px by default
  lg?: string;  // 8px by default
}
```

### Touch Targets

```typescript
interface ThemeTouchTargets {
  min?: string;         // 44px by default (WCAG minimum)
  comfortable?: string; // 48px by default (recommended)
}
```

## Advanced Usage

### Auto Dark Mode

```javascript
import { detectSystemTheme, watchSystemTheme } from '@kerebron/editor';

// Detect current system preference
const systemTheme = detectSystemTheme();
themeManager.setTheme(systemTheme === 'dark' ? 'dark' : 'default');

// Watch for system theme changes
const unwatch = watchSystemTheme((theme) => {
  themeManager.setTheme(theme === 'dark' ? 'dark' : 'default');
});

// Stop watching when component unmounts
// unwatch();
```

### Custom Theme Presets

```javascript
// Register a custom preset
themeManager.registerPreset({
  name: 'brand',
  displayName: 'Company Brand',
  description: 'Our company brand colors and styling',
  config: {
    colors: {
      primary: '#1a365d',
      primaryHover: '#2c5282',
      surface: '#f7fafc',
      surfaceElevated: '#edf2f7',
    },
    borderRadius: {
      sm: '2px',
      md: '4px', 
      lg: '6px',
    }
  }
});

// Use the custom preset
themeManager.setTheme('brand');
```

### Scoped Theming

```javascript
// Apply theme to specific editor instance
const editorElement = document.querySelector('.my-editor');
const scopedThemeManager = createThemeManager(editorElement);

scopedThemeManager.setTheme('dark');
```

### React Integration

```jsx
import { useEffect, useState } from 'react';
import { createThemeManager, detectSystemTheme } from '@kerebron/editor';

function MyEditor() {
  const [themeManager, setThemeManager] = useState(null);
  const [currentTheme, setCurrentTheme] = useState('default');

  useEffect(() => {
    const manager = createThemeManager();
    setThemeManager(manager);
    
    // Auto-detect system theme
    const systemTheme = detectSystemTheme();
    const initialTheme = systemTheme === 'dark' ? 'dark' : 'default';
    manager.setTheme(initialTheme);
    setCurrentTheme(initialTheme);
  }, []);

  const handleThemeChange = (themeName) => {
    if (themeManager) {
      themeManager.setTheme(themeName);
      setCurrentTheme(themeName);
    }
  };

  return (
    <div>
      <select value={currentTheme} onChange={(e) => handleThemeChange(e.target.value)}>
        <option value="default">Default</option>
        <option value="corporate">Corporate</option>
        <option value="creative">Creative</option>
        <option value="dark">Dark</option>
      </select>
      
      <div className="kb-editor">
        {/* Your editor component */}
      </div>
    </div>
  );
}
```

### Vue Integration

```vue
<template>
  <div>
    <select v-model="currentTheme" @change="handleThemeChange">
      <option value="default">Default</option>
      <option value="corporate">Corporate</option>
      <option value="creative">Creative</option>
      <option value="dark">Dark</option>
    </select>
    
    <div class="kb-editor">
      <!-- Your editor component -->
    </div>
  </div>
</template>

<script>
import { createThemeManager } from '@kerebron/editor';

export default {
  data() {
    return {
      themeManager: null,
      currentTheme: 'default'
    };
  },
  
  mounted() {
    this.themeManager = createThemeManager();
    this.handleThemeChange();
  },
  
  methods: {
    handleThemeChange() {
      if (this.themeManager) {
        this.themeManager.setTheme(this.currentTheme);
      }
    }
  }
};
</script>
```

## CSS-Only Theming

If you prefer to use CSS custom properties directly:

```css
:root {
  /* Override default theme variables */
  --kb-color-primary: #ff6b35;
  --kb-color-primary-hover: #e55a2b;
  --kb-color-surface: #fef5f3;
  --kb-radius-md: 12px;
}

/* Dark mode override */
@media (prefers-color-scheme: dark) {
  :root {
    --kb-color-primary: #ff8566;
    --kb-color-surface: #1a1a1a;
    --kb-color-text: #ffffff;
  }
}
```

## Performance Considerations

- Theme changes are applied via CSS custom properties for optimal performance
- No layout recalculation needed when switching themes
- Automatic RGB value calculation for transparency effects
- Minimal JavaScript overhead

## Accessibility

The theme system includes built-in accessibility features:

- High contrast mode support via CSS media queries
- WCAG-compliant touch target sizes
- Color contrast validation (coming soon)
- Reduced motion preference support
- Screen reader compatible color schemes

## Browser Support

- Modern browsers with CSS custom properties support
- Graceful degradation for older browsers
- Mobile Safari optimizations
- Touch device optimizations