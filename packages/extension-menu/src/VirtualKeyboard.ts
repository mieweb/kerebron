import { EditorView } from 'prosemirror-view';
import { Plugin, PluginKey } from 'prosemirror-state';

const virtualKeyboardKey = new PluginKey('virtualKeyboard');

export interface VirtualKeyboardConfig {
  /// Whether to automatically adjust for virtual keyboard
  enabled?: boolean;
  /// Custom CSS class to add when virtual keyboard is detected
  keyboardVisibleClass?: string;
  /// Minimum height reduction to trigger virtual keyboard detection
  minHeightReduction?: number;
}

export class VirtualKeyboardPlugin extends Plugin {
  constructor(config: VirtualKeyboardConfig = {}) {
    super({
      key: virtualKeyboardKey,
      view: (view) => new VirtualKeyboardView(view, config),
    });
  }
}

class VirtualKeyboardView {
  private initialViewportHeight: number;
  private currentViewportHeight: number;
  private isKeyboardVisible = false;
  private resizeObserver?: ResizeObserver;
  private visualViewport?: VisualViewport;

  constructor(
    private view: EditorView,
    private config: VirtualKeyboardConfig
  ) {
    this.initialViewportHeight = window.innerHeight;
    this.currentViewportHeight = window.innerHeight;
    
    this.setupKeyboardDetection();
  }

  private setupKeyboardDetection() {
    // Use Visual Viewport API if available (modern mobile browsers)
    if ('visualViewport' in window) {
      this.visualViewport = window.visualViewport!;
      this.visualViewport.addEventListener('resize', this.handleVisualViewportResize);
      return;
    }

    // Fallback: detect viewport height changes
    this.setupViewportHeightDetection();
  }

  private handleVisualViewportResize = () => {
    if (!this.visualViewport) return;

    const heightReduction = window.innerHeight - this.visualViewport.height;
    const minReduction = this.config.minHeightReduction || 150;
    
    if (heightReduction > minReduction && !this.isKeyboardVisible) {
      this.onKeyboardShow();
    } else if (heightReduction <= minReduction && this.isKeyboardVisible) {
      this.onKeyboardHide();
    }
  };

  private setupViewportHeightDetection() {
    const handleResize = () => {
      const newHeight = window.innerHeight;
      const heightReduction = this.initialViewportHeight - newHeight;
      const minReduction = this.config.minHeightReduction || 150;

      if (heightReduction > minReduction && !this.isKeyboardVisible) {
        this.onKeyboardShow();
      } else if (heightReduction <= minReduction && this.isKeyboardVisible) {
        this.onKeyboardHide();
      }

      this.currentViewportHeight = newHeight;
    };

    window.addEventListener('resize', handleResize);
    
    // Also listen for orientation changes on mobile
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.initialViewportHeight = window.innerHeight;
        handleResize();
      }, 500); // Wait for orientation change to complete
    });
  }

  private onKeyboardShow() {
    this.isKeyboardVisible = true;
    
    const editorElement = this.view.dom.closest('.kb-editor') as HTMLElement;
    if (editorElement) {
      const className = this.config.keyboardVisibleClass || 'kb-editor--keyboard-visible';
      editorElement.classList.add(className);
    }

    // Scroll to keep cursor visible
    this.scrollToCursor();
    
    // Dispatch custom event
    this.view.dom.dispatchEvent(new CustomEvent('kb-virtual-keyboard-show', {
      bubbles: true,
      detail: { view: this.view }
    }));
  }

  private onKeyboardHide() {
    this.isKeyboardVisible = false;
    
    const editorElement = this.view.dom.closest('.kb-editor') as HTMLElement;
    if (editorElement) {
      const className = this.config.keyboardVisibleClass || 'kb-editor--keyboard-visible';
      editorElement.classList.remove(className);
    }
    
    // Dispatch custom event
    this.view.dom.dispatchEvent(new CustomEvent('kb-virtual-keyboard-hide', {
      bubbles: true,
      detail: { view: this.view }
    }));
  }

  private scrollToCursor() {
    // Get cursor position
    const selection = this.view.state.selection;
    const coords = this.view.coordsAtPos(selection.from);
    
    // Get available viewport height
    const availableHeight = this.visualViewport 
      ? this.visualViewport.height 
      : this.currentViewportHeight;
    
    // Check if cursor is visible in the reduced viewport
    const cursorY = coords.top;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const relativeY = cursorY - scrollTop;
    
    // If cursor is below the visible area, scroll to bring it into view
    if (relativeY > availableHeight - 100) { // Leave some margin
      const targetScrollTop = cursorY - (availableHeight - 100);
      window.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }
  }

  update(view: EditorView) {
    // Update view reference
    this.view = view;
    
    // Re-scroll to cursor if keyboard is visible and selection changed
    if (this.isKeyboardVisible) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => this.scrollToCursor(), 10);
    }
  }

  destroy() {
    if (this.visualViewport) {
      this.visualViewport.removeEventListener('resize', this.handleVisualViewportResize);
    }
    
    // Clean up event listeners
    window.removeEventListener('resize', this.handleVisualViewportResize);
  }
}

export function createVirtualKeyboardPlugin(config: VirtualKeyboardConfig = {}): Plugin {
  // Only enable on mobile devices
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   window.innerWidth < 768;
  
  if (!isMobile || config.enabled === false) {
    // Return a no-op plugin for desktop
    return new Plugin({
      key: virtualKeyboardKey,
    });
  }

  return new VirtualKeyboardPlugin(config);
}