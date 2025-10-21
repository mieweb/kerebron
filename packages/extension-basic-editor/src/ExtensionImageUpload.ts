import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Slice } from 'prosemirror-model';

import { Extension } from '@kerebron/editor';

export interface ImageUploadOptions {
  /**
   * Maximum file size in bytes (default: 10MB)
   */
  maxFileSize?: number;

  /**
   * Allowed image MIME types
   */
  allowedMimeTypes?: string[];

  /**
   * Custom upload handler. If not provided, images will be converted to base64 data URLs.
   * Should return the URL of the uploaded image.
   */
  uploadHandler?: (file: File) => Promise<string>;
}

const imageUploadKey = new PluginKey('imageUpload');

/**
 * Convert a File to a base64 data URL
 */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Check if a file is an image
 */
function isImage(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.some(type => file.type.match(type));
}

/**
 * Insert an image into the editor at the given position
 */
function insertImage(
  view: EditorView,
  pos: number,
  src: string,
  alt?: string,
  title?: string,
) {
  const { schema } = view.state;
  const imageType = schema.nodes.image;

  if (!imageType) {
    console.warn('Image node type not found in schema');
    return;
  }

  const node = imageType.create({ src, alt, title });
  const transaction = view.state.tr.insert(pos, node);
  view.dispatch(transaction);
}

/**
 * Handle image files from drop or paste events
 */
async function handleImageFiles(
  view: EditorView,
  files: File[],
  pos: number,
  options: ImageUploadOptions,
): Promise<void> {
  const {
    maxFileSize = 10 * 1024 * 1024, // 10MB
    allowedMimeTypes = ['^image/'],
    uploadHandler,
  } = options;

  for (const file of files) {
    // Check if it's an image
    if (!isImage(file, allowedMimeTypes)) {
      continue;
    }

    // Check file size
    if (file.size > maxFileSize) {
      console.warn(
        `Image file "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${(maxFileSize / 1024 / 1024).toFixed(2)}MB.`,
      );
      continue;
    }

    try {
      // Upload or convert to data URL
      const src = uploadHandler
        ? await uploadHandler(file)
        : await fileToDataURL(file);

      // Insert the image
      insertImage(view, pos, src, file.name);

      // Increment position for next image
      pos += 1;
    } catch (error) {
      console.error(`Failed to process image "${file.name}":`, error);
    }
  }
}

/**
 * Create the image upload plugin
 */
function createImageUploadPlugin(options: ImageUploadOptions = {}): Plugin {
  return new Plugin({
    key: imageUploadKey,

    props: {
      /**
       * Handle file drops
       */
      handleDrop(view, event, slice, moved) {
        // If content was moved from within the editor, let the default handler deal with it
        if (moved) return false;

        const files = Array.from(event.dataTransfer?.files || []);
        if (files.length === 0) return false;

        // Check if any files are images
        const { allowedMimeTypes = ['^image/'] } = options;
        const hasImages = files.some(file => isImage(file, allowedMimeTypes));
        if (!hasImages) return false;

        // Prevent default drop behavior
        event.preventDefault();

        // Get drop position
        const coords = { left: event.clientX, top: event.clientY };
        const pos = view.posAtCoords(coords);
        if (!pos) return false;

        // Handle the image files
        handleImageFiles(view, files, pos.pos, options);

        return true;
      },

      /**
       * Handle paste events with images
       */
      handlePaste(view, event, slice) {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItems = items.filter(item => item.type.startsWith('image/'));

        if (imageItems.length === 0) return false;

        // Prevent default paste behavior
        event.preventDefault();

        // Convert clipboard items to files
        const files: File[] = [];
        for (const item of imageItems) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }

        if (files.length === 0) return false;

        // Get current cursor position
        const { from } = view.state.selection;

        // Handle the image files
        handleImageFiles(view, files, from, options);

        return true;
      },
    },
  });
}

/**
 * Extension that adds image upload support via drag & drop and paste
 */
export class ExtensionImageUpload extends Extension {
  name = 'imageUpload';

  constructor(protected config: Partial<ImageUploadOptions> = {}) {
    super(config);
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [createImageUploadPlugin(this.config)];
  }
}
