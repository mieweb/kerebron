/**
 * Kerebron Performance Utilities
 * Optimization tools for better performance
 */

export interface PerformanceConfig {
  /// Enable performance monitoring
  monitoring?: boolean;
  /// Debounce time for theme changes (ms)
  themeDebounce?: number;
  /// Enable lazy loading for heavy features
  lazyLoading?: boolean;
  /// Enable virtual scrolling for large documents
  virtualScrolling?: boolean;
}

export class PerformanceManager {
  private config: PerformanceConfig;
  private metrics: Map<string, number> = new Map();
  private timers: Map<string, number> = new Map();

  constructor(config: PerformanceConfig = {}) {
    this.config = {
      monitoring: true,
      themeDebounce: 100,
      lazyLoading: true,
      virtualScrolling: false,
      ...config,
    };
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string): void {
    if (!this.config.monitoring) return;
    this.timers.set(name, performance.now());
  }

  /**
   * End timing an operation and record the duration
   */
  endTimer(name: string): number {
    if (!this.config.monitoring) return 0;
    
    const startTime = this.timers.get(name);
    if (!startTime) return 0;
    
    const duration = performance.now() - startTime;
    this.metrics.set(name, duration);
    this.timers.delete(name);
    
    return duration;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Debounced theme change function
   */
  createDebouncedThemeChanger(themeManager: any): (theme: string) => void {
    let timeout: number;
    
    return (theme: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.startTimer('theme-change');
        themeManager.setTheme(theme);
        const duration = this.endTimer('theme-change');
        
        if (duration > 100) {
          console.warn(`Theme change took ${duration.toFixed(2)}ms - consider optimizing`);
        }
      }, this.config.themeDebounce);
    };
  }

  /**
   * Lazy load extension function
   */
  async lazyLoadExtension(importFn: () => Promise<any>): Promise<any> {
    if (!this.config.lazyLoading) {
      return await importFn();
    }

    this.startTimer('extension-load');
    
    try {
      const module = await importFn();
      const duration = this.endTimer('extension-load');
      
      if (duration > 500) {
        console.warn(`Extension took ${duration.toFixed(2)}ms to load - consider code splitting`);
      }
      
      return module;
    } catch (error) {
      this.endTimer('extension-load');
      throw error;
    }
  }

  /**
   * Optimize images for editor content
   */
  static optimizeImage(
    src: string, 
    maxWidth: number = 800, 
    quality: number = 0.8
  ): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const optimizedSrc = canvas.toDataURL('image/jpeg', quality);
        
        resolve(optimizedSrc);
      };
      img.src = src;
    });
  }

  /**
   * Monitor memory usage
   */
  getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
  } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
      };
    }
    return null;
  }

  /**
   * Create an intersection observer for lazy loading
   */
  createLazyLoader(callback: (entries: IntersectionObserverEntry[]) => void): IntersectionObserver {
    return new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: 0.1,
    });
  }

  /**
   * Throttle function for performance-critical events
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: number;
    let lastExecTime = 0;
    
    return (...args: Parameters<T>) => {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func(...args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func(...args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  /**
   * Debounce function for user input
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: number;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * Measure Core Web Vitals
   */
  measureWebVitals(): Promise<{
    fcp?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
  }> {
    return new Promise((resolve) => {
      const metrics: any = {};
      
      // First Contentful Paint
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            metrics.fcp = entry.startTime;
          }
        }
      }).observe({ entryTypes: ['paint'] });
      
      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        metrics.lcp = lastEntry.startTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });
      
      // First Input Delay
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metrics.fid = (entry as any).processingStart - entry.startTime;
        }
      }).observe({ entryTypes: ['first-input'] });
      
      // Cumulative Layout Shift
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        metrics.cls = clsValue;
      }).observe({ entryTypes: ['layout-shift'] });
      
      // Resolve after a delay to collect metrics
      setTimeout(() => resolve(metrics), 3000);
    });
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.metrics.clear();
    this.timers.clear();
  }
}

/**
 * Create a performance manager
 */
export function createPerformanceManager(config?: PerformanceConfig): PerformanceManager {
  return new PerformanceManager(config);
}

/**
 * Bundle size analyzer
 */
export function analyzeBundleSize(): Promise<{
  total: number;
  gzipped: number;
  breakdown: Record<string, number>;
}> {
  return new Promise((resolve) => {
    // This would typically be done at build time
    // For runtime, we can estimate based on script tags
    const scripts = Array.from(document.scripts);
    const breakdown: Record<string, number> = {};
    let total = 0;
    
    scripts.forEach((script) => {
      if (script.src) {
        // Estimate size (this is a rough approximation)
        const name = script.src.split('/').pop() || 'unknown';
        const estimatedSize = script.innerHTML.length || 50000; // Default estimate
        breakdown[name] = estimatedSize;
        total += estimatedSize;
      }
    });
    
    resolve({
      total,
      gzipped: total * 0.3, // Rough gzip estimate
      breakdown,
    });
  });
}

/**
 * CSS performance optimizer
 */
export class CSSOptimizer {
  /**
   * Remove unused CSS rules (basic implementation)
   */
  static removeUnusedCSS(): void {
    const stylesheets = Array.from(document.styleSheets);
    const usedSelectors = new Set<string>();
    
    // Collect all used selectors
    document.querySelectorAll('*').forEach((element) => {
      if (element.className) {
        element.className.split(' ').forEach((className) => {
          usedSelectors.add(`.${className}`);
        });
      }
    });
    
    // This is a simplified version - in practice, you'd want a more sophisticated approach
    stylesheets.forEach((stylesheet) => {
      try {
        const rules = stylesheet.cssRules || stylesheet.rules;
        if (rules) {
          for (let i = rules.length - 1; i >= 0; i--) {
            const rule = rules[i] as CSSStyleRule;
            if (rule.selectorText && !usedSelectors.has(rule.selectorText)) {
              // In a real implementation, you'd remove the rule
              // stylesheet.deleteRule(i);
              console.log('Unused CSS rule:', rule.selectorText);
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheets can't be accessed
        console.warn('Cannot analyze stylesheet:', stylesheet.href);
      }
    });
  }

  /**
   * Optimize CSS animations for performance
   */
  static optimizeAnimations(): void {
    const style = document.createElement('style');
    style.textContent = `
      /* Force hardware acceleration for animations */
      .kb-toolbar__item,
      .kb-dropdown__menu,
      .kb-format-popup {
        will-change: transform, opacity;
      }
      
      /* Optimize transforms */
      .kb-toolbar__item--pressed {
        transform: scale(0.95) translateZ(0);
      }
      
      /* Use transform instead of changing layout properties */
      .kb-dropdown__menu {
        transform: translateY(-4px) translateZ(0);
      }
      
      .kb-dropdown--open .kb-dropdown__menu {
        transform: translateY(0) translateZ(0);
      }
    `;
    document.head.appendChild(style);
  }
}