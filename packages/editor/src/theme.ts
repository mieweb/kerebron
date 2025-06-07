/**
 * Kerebron Theme System
 * JavaScript API for dynamic theming and brand customization
 */

export interface ThemeColors {
  primary?: string;
  primaryHover?: string;
  text?: string;
  textMuted?: string;
  surface?: string;
  surfaceElevated?: string;
  border?: string;
  borderStrong?: string;
  success?: string;
  warning?: string;
  error?: string;
}

export interface ThemeSpacing {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
}

export interface ThemeTypography {
  xs?: string;
  sm?: string;
  base?: string;
  lg?: string;
}

export interface ThemeBorderRadius {
  sm?: string;
  md?: string;
  lg?: string;
}

export interface ThemeConfig {
  colors?: ThemeColors;
  spacing?: ThemeSpacing;
  typography?: ThemeTypography;
  borderRadius?: ThemeBorderRadius;
  touchTargets?: {
    min?: string;
    comfortable?: string;
  };
}

export interface ThemePreset {
  name: string;
  displayName: string;
  description?: string;
  config: ThemeConfig;
}

// Built-in theme presets
export const THEME_PRESETS: Record<string, ThemePreset> = {
  default: {
    name: 'default',
    displayName: 'Default Blue',
    description: 'Clean, modern blue theme suitable for most applications',
    config: {
      colors: {
        primary: '#3b82f6',
        primaryHover: '#2563eb',
        text: '#1f2937',
        textMuted: '#6b7280',
        surface: '#ffffff',
        surfaceElevated: '#f9fafb',
        border: '#e5e7eb',
        borderStrong: '#d1d5db',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
    },
  },
  
  corporate: {
    name: 'corporate',
    displayName: 'Corporate',
    description: 'Professional navy theme for business applications',
    config: {
      colors: {
        primary: '#1e40af',
        primaryHover: '#1e3a8a',
        text: '#1f2937',
        textMuted: '#6b7280',
        surface: '#ffffff',
        surfaceElevated: '#f8fafc',
        border: '#e2e8f0',
        borderStrong: '#cbd5e1',
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
      },
    },
  },
  
  creative: {
    name: 'creative',
    displayName: 'Creative Purple',
    description: 'Vibrant purple theme for creative and design applications',
    config: {
      colors: {
        primary: '#7c3aed',
        primaryHover: '#6d28d9',
        text: '#1f2937',
        textMuted: '#6b7280',
        surface: '#ffffff',
        surfaceElevated: '#faf5ff',
        border: '#e9d5ff',
        borderStrong: '#d8b4fe',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
    },
  },
  
  forest: {
    name: 'forest',
    displayName: 'Forest Green',
    description: 'Natural green theme with earthy tones',
    config: {
      colors: {
        primary: '#059669',
        primaryHover: '#047857',
        text: '#1f2937',
        textMuted: '#6b7280',
        surface: '#ffffff',
        surfaceElevated: '#f0fdf4',
        border: '#bbf7d0',
        borderStrong: '#86efac',
        success: '#22c55e',
        warning: '#eab308',
        error: '#ef4444',
      },
    },
  },
  
  dark: {
    name: 'dark',
    displayName: 'Dark Mode',
    description: 'Dark theme for low-light environments',
    config: {
      colors: {
        primary: '#3b82f6',
        primaryHover: '#2563eb',
        text: '#f9fafb',
        textMuted: '#9ca3af',
        surface: '#1f2937',
        surfaceElevated: '#374151',
        border: '#374151',
        borderStrong: '#4b5563',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
    },
  },
  
  midnight: {
    name: 'midnight',
    displayName: 'Midnight',
    description: 'Ultra-dark theme with purple accents',
    config: {
      colors: {
        primary: '#8b5cf6',
        primaryHover: '#7c3aed',
        text: '#f3f4f6',
        textMuted: '#9ca3af',
        surface: '#111827',
        surfaceElevated: '#1f2937',
        border: '#374151',
        borderStrong: '#4b5563',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
    },
  },
};

export class ThemeManager {
  private currentTheme: ThemeConfig = {};
  private element: HTMLElement | null = null;

  constructor(element?: HTMLElement) {
    this.element = element || document.documentElement;
  }

  /**
   * Apply a theme configuration to the editor
   */
  setTheme(theme: ThemeConfig | string): void {
    let config: ThemeConfig;
    
    if (typeof theme === 'string') {
      const preset = THEME_PRESETS[theme];
      if (!preset) {
        throw new Error(`Theme preset "${theme}" not found`);
      }
      config = preset.config;
    } else {
      config = theme;
    }

    this.currentTheme = { ...this.currentTheme, ...config };
    this.applyTheme();
  }

  /**
   * Get the current theme configuration
   */
  getTheme(): ThemeConfig {
    return { ...this.currentTheme };
  }

  /**
   * Reset to default theme
   */
  resetTheme(): void {
    this.currentTheme = {};
    this.removeCustomProperties();
  }

  /**
   * Get available theme presets
   */
  getPresets(): ThemePreset[] {
    return Object.values(THEME_PRESETS);
  }

  /**
   * Register a custom theme preset
   */
  registerPreset(preset: ThemePreset): void {
    THEME_PRESETS[preset.name] = preset;
  }

  /**
   * Apply the current theme to the DOM
   */
  private applyTheme(): void {
    if (!this.element) return;

    const { colors, spacing, typography, borderRadius, touchTargets } = this.currentTheme;

    // Apply color variables
    if (colors) {
      this.setCSSProperty('--kb-color-primary', colors.primary);
      this.setCSSProperty('--kb-color-primary-hover', colors.primaryHover);
      this.setCSSProperty('--kb-color-text', colors.text);
      this.setCSSProperty('--kb-color-text-muted', colors.textMuted);
      this.setCSSProperty('--kb-color-surface', colors.surface);
      this.setCSSProperty('--kb-color-surface-elevated', colors.surfaceElevated);
      this.setCSSProperty('--kb-color-border', colors.border);
      this.setCSSProperty('--kb-color-border-strong', colors.borderStrong);
      this.setCSSProperty('--kb-color-success', colors.success);
      this.setCSSProperty('--kb-color-warning', colors.warning);
      this.setCSSProperty('--kb-color-error', colors.error);

      // Calculate RGB values for transparency effects
      if (colors.primary) {
        const rgb = this.hexToRgb(colors.primary);
        if (rgb) {
          this.setCSSProperty('--kb-color-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        }
      }
    }

    // Apply spacing variables
    if (spacing) {
      this.setCSSProperty('--kb-space-xs', spacing.xs);
      this.setCSSProperty('--kb-space-sm', spacing.sm);
      this.setCSSProperty('--kb-space-md', spacing.md);
      this.setCSSProperty('--kb-space-lg', spacing.lg);
      this.setCSSProperty('--kb-space-xl', spacing.xl);
    }

    // Apply typography variables
    if (typography) {
      this.setCSSProperty('--kb-text-xs', typography.xs);
      this.setCSSProperty('--kb-text-sm', typography.sm);
      this.setCSSProperty('--kb-text-base', typography.base);
      this.setCSSProperty('--kb-text-lg', typography.lg);
    }

    // Apply border radius variables
    if (borderRadius) {
      this.setCSSProperty('--kb-radius-sm', borderRadius.sm);
      this.setCSSProperty('--kb-radius-md', borderRadius.md);
      this.setCSSProperty('--kb-radius-lg', borderRadius.lg);
    }

    // Apply touch target variables
    if (touchTargets) {
      this.setCSSProperty('--kb-touch-target-min', touchTargets.min);
      this.setCSSProperty('--kb-touch-target-comfortable', touchTargets.comfortable);
    }
  }

  private setCSSProperty(property: string, value?: string): void {
    if (!this.element || !value) return;
    this.element.style.setProperty(property, value);
  }

  private removeCustomProperties(): void {
    if (!this.element) return;

    const properties = [
      '--kb-color-primary',
      '--kb-color-primary-hover',
      '--kb-color-primary-rgb',
      '--kb-color-text',
      '--kb-color-text-muted',
      '--kb-color-surface',
      '--kb-color-surface-elevated',
      '--kb-color-border',
      '--kb-color-border-strong',
      '--kb-color-success',
      '--kb-color-warning',
      '--kb-color-error',
      '--kb-space-xs',
      '--kb-space-sm',
      '--kb-space-md',
      '--kb-space-lg',
      '--kb-space-xl',
      '--kb-text-xs',
      '--kb-text-sm',
      '--kb-text-base',
      '--kb-text-lg',
      '--kb-radius-sm',
      '--kb-radius-md',
      '--kb-radius-lg',
      '--kb-touch-target-min',
      '--kb-touch-target-comfortable',
    ];

    properties.forEach(property => {
      this.element!.style.removeProperty(property);
    });
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  }
}

/**
 * Create a theme manager for an editor element
 */
export function createThemeManager(element?: HTMLElement): ThemeManager {
  return new ThemeManager(element);
}

/**
 * Auto-detect system theme preference
 */
export function detectSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Listen for system theme changes
 */
export function watchSystemTheme(callback: (theme: 'light' | 'dark') => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };
  
  mediaQuery.addEventListener('change', handler);
  
  return () => mediaQuery.removeEventListener('change', handler);
}