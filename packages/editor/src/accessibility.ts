/**
 * Kerebron Accessibility Utilities
 * WCAG 2.1 AA compliance and accessibility enhancements
 */

export interface AccessibilityConfig {
  /// Enable high contrast mode detection
  highContrast?: boolean;
  /// Enable reduced motion detection
  reducedMotion?: boolean;
  /// Enable focus management
  focusManagement?: boolean;
  /// Enable screen reader announcements
  announcements?: boolean;
}

export class AccessibilityManager {
  private config: AccessibilityConfig;
  private element: HTMLElement;
  private announcer: HTMLElement | null = null;

  constructor(element: HTMLElement, config: AccessibilityConfig = {}) {
    this.element = element;
    this.config = {
      highContrast: true,
      reducedMotion: true,
      focusManagement: true,
      announcements: true,
      ...config,
    };

    this.init();
  }

  private init() {
    if (this.config.highContrast) {
      this.setupHighContrastDetection();
    }
    
    if (this.config.reducedMotion) {
      this.setupReducedMotionDetection();
    }
    
    if (this.config.focusManagement) {
      this.setupFocusManagement();
    }
    
    if (this.config.announcements) {
      this.setupScreenReaderAnnouncer();
    }

    // Add ARIA attributes to the editor
    this.element.setAttribute('role', 'textbox');
    this.element.setAttribute('aria-multiline', 'true');
    this.element.setAttribute('aria-label', 'Rich text editor');
  }

  private setupHighContrastDetection() {
    const updateHighContrast = () => {
      const isHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
      this.element.classList.toggle('kb-editor--high-contrast', isHighContrast);
    };

    updateHighContrast();
    window.matchMedia('(prefers-contrast: high)').addEventListener('change', updateHighContrast);
  }

  private setupReducedMotionDetection() {
    const updateReducedMotion = () => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.element.classList.toggle('kb-editor--reduced-motion', prefersReducedMotion);
    };

    updateReducedMotion();
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', updateReducedMotion);
  }

  private setupFocusManagement() {
    // Ensure focus is visible
    this.element.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      if (target && !target.classList.contains('kb-focus-visible')) {
        target.classList.add('kb-focus-visible');
      }
    });

    this.element.addEventListener('focusout', (e) => {
      const target = e.target as HTMLElement;
      if (target) {
        target.classList.remove('kb-focus-visible');
      }
    });

    // Handle keyboard vs mouse focus
    let hadKeyboardEvent = false;
    
    this.element.addEventListener('keydown', () => {
      hadKeyboardEvent = true;
    });

    this.element.addEventListener('mousedown', () => {
      hadKeyboardEvent = false;
    });

    this.element.addEventListener('focus', (e) => {
      if (hadKeyboardEvent) {
        (e.target as HTMLElement).classList.add('kb-keyboard-focus');
      }
    }, true);

    this.element.addEventListener('blur', (e) => {
      (e.target as HTMLElement).classList.remove('kb-keyboard-focus');
    }, true);
  }

  private setupScreenReaderAnnouncer() {
    // Create a live region for screen reader announcements
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.className = 'kb-sr-only';
    this.announcer.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `;
    
    document.body.appendChild(this.announcer);
  }

  /**
   * Announce text to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.announcer) return;

    this.announcer.setAttribute('aria-live', priority);
    this.announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (this.announcer) {
        this.announcer.textContent = '';
      }
    }, 1000);
  }

  /**
   * Check color contrast ratio between two colors
   */
  static checkColorContrast(foreground: string, background: string): {
    ratio: number;
    passes: {
      normal: boolean;
      large: boolean;
    };
  } {
    const getRgb = (color: string) => {
      const hex = color.replace('#', '');
      return {
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16),
      };
    };

    const getLuminance = (rgb: { r: number; g: number; b: number }) => {
      const sRGB = [rgb.r, rgb.g, rgb.b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    };

    const fgRgb = getRgb(foreground);
    const bgRgb = getRgb(background);
    
    const fgLuminance = getLuminance(fgRgb);
    const bgLuminance = getLuminance(bgRgb);
    
    const ratio = (Math.max(fgLuminance, bgLuminance) + 0.05) / 
                  (Math.min(fgLuminance, bgLuminance) + 0.05);

    return {
      ratio,
      passes: {
        normal: ratio >= 4.5, // WCAG AA for normal text
        large: ratio >= 3,    // WCAG AA for large text
      },
    };
  }

  /**
   * Generate keyboard shortcuts help text
   */
  static generateKeyboardShortcutsHelp(): string {
    return `
Keyboard Shortcuts:
- Ctrl/Cmd + B: Bold
- Ctrl/Cmd + I: Italic
- Ctrl/Cmd + U: Underline
- Ctrl/Cmd + Z: Undo
- Ctrl/Cmd + Y: Redo
- Ctrl/Cmd + K: Insert Link
- Alt + 1-6: Heading levels
- Tab: Indent list item
- Shift + Tab: Outdent list item
- Escape: Clear formatting / Close menus
- Arrow keys: Navigate menu items
- Enter/Space: Activate menu items
    `.trim();
  }

  destroy() {
    if (this.announcer && this.announcer.parentNode) {
      this.announcer.parentNode.removeChild(this.announcer);
    }
  }
}

/**
 * Create an accessibility manager for an editor
 */
export function createAccessibilityManager(
  element: HTMLElement,
  config?: AccessibilityConfig
): AccessibilityManager {
  return new AccessibilityManager(element, config);
}

/**
 * Validate theme colors for accessibility compliance
 */
export function validateThemeAccessibility(colors: Record<string, string>): {
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (colors.text && colors.surface) {
    const contrast = AccessibilityManager.checkColorContrast(colors.text, colors.surface);
    if (!contrast.passes.normal) {
      errors.push(`Text color contrast ratio (${contrast.ratio.toFixed(2)}) does not meet WCAG AA requirements (4.5:1)`);
    }
  }

  if (colors.primary && colors.surface) {
    const contrast = AccessibilityManager.checkColorContrast(colors.primary, colors.surface);
    if (!contrast.passes.normal) {
      warnings.push(`Primary color contrast ratio (${contrast.ratio.toFixed(2)}) should meet WCAG AA requirements (4.5:1)`);
    }
  }

  if (colors.textMuted && colors.surface) {
    const contrast = AccessibilityManager.checkColorContrast(colors.textMuted, colors.surface);
    if (!contrast.passes.normal) {
      warnings.push(`Muted text color contrast ratio (${contrast.ratio.toFixed(2)}) may not meet WCAG AA requirements (4.5:1)`);
    }
  }

  return { warnings, errors };
}