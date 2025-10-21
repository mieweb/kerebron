import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { Extension } from '@kerebron/editor';

export interface MediaUploadOptions {
  /** Maximum file size in bytes (default: 10MB for images) */
  maxFileSize?: number;

  /** Maximum file size for videos (default: 50MB) */
  maxVideoFileSize?: number;

  /** Allowed image MIME types */
  allowedImageTypes?: string[];

  /** Allowed video MIME types */
  allowedVideoTypes?: string[];

  /** Use object URLs for videos instead of base64 (default: true) */
  useObjectURLForVideos?: boolean;

  /** Custom upload handler. Returns the URL of uploaded media. */
  uploadHandler?: (file: File) => Promise<string>;
}

const mediaUploadKey = new PluginKey('mediaUpload');

/** Convert a File to a base64 data URL */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Convert a File to an object URL (better for videos) */
function fileToObjectURL(file: File): string {
  return URL.createObjectURL(file);
}

/** Check if a file is an image */
function isImage(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.some((type) => file.type.match(type));
}

/** Check if a file is a video */
function isVideo(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.some((type) => file.type.match(type));
}

/** Insert an image into the editor at the given position */
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

/** Insert a video into the editor at the given position */
function insertVideo(
  view: EditorView,
  pos: number,
  src: string,
  title?: string,
  width?: string,
  height?: string,
) {
  const { schema } = view.state;
  const videoType = schema.nodes.video;

  if (!videoType) {
    console.warn('Video node type not found in schema');
    return;
  }

  const node = videoType.create({ src, title, width, height, controls: true });
  const transaction = view.state.tr.insert(pos, node);
  view.dispatch(transaction);
}

/** Handle media files (images and videos) from drop or paste events */
async function handleMediaFiles(
  view: EditorView,
  files: File[],
  pos: number,
  options: MediaUploadOptions,
): Promise<void> {
  const {
    maxFileSize = 10 * 1024 * 1024, // 10MB for images
    maxVideoFileSize = 50 * 1024 * 1024, // 50MB for videos
    allowedImageTypes = ['^image/'],
    allowedVideoTypes = ['^video/'],
    uploadHandler,
  } = options;

  for (const file of files) {
    const isImageFile = isImage(file, allowedImageTypes);
    const isVideoFile = isVideo(file, allowedVideoTypes);

    // Skip if not an image or video
    if (!isImageFile && !isVideoFile) {
      continue;
    }

    // Check file size
    const sizeLimit = isVideoFile ? maxVideoFileSize : maxFileSize;
    if (file.size > sizeLimit) {
      console.warn(
        `${isVideoFile ? 'Video' : 'Image'} file "${file.name}" is too large (${
          (file.size / 1024 / 1024).toFixed(2)
        }MB). Maximum size is ${(sizeLimit / 1024 / 1024).toFixed(2)}MB.`,
      );
      continue;
    }

    try {
      // Upload or convert to data URL
      console.log(
        `Processing ${isVideoFile ? 'video' : 'image'}: ${file.name} (${
          (file.size / 1024 / 1024).toFixed(2)
        }MB, ${file.type})`,
      );

      let src: string;
      if (uploadHandler) {
        src = await uploadHandler(file);
      } else if (isVideoFile && options.useObjectURLForVideos !== false) {
        // Use object URL for videos (better performance, doesn't bloat the document)
        src = fileToObjectURL(file);
        console.log('Using object URL for video:', src);
      } else {
        // Use base64 data URL
        src = await fileToDataURL(file);
        console.log(
          `${
            isVideoFile ? 'Video' : 'Image'
          } converted to data URL, length: ${src.length} characters`,
        );
      }

      // Insert the media
      if (isVideoFile) {
        insertVideo(view, pos, src, file.name);
        console.log('Video inserted into editor');
      } else {
        insertImage(view, pos, src, file.name);
        console.log('Image inserted into editor');
      }

      // Increment position for next media
      pos += 1;
    } catch (error) {
      console.error(
        `Failed to process ${isVideoFile ? 'video' : 'image'} "${file.name}":`,
        error,
      );
    }
  }
}

/** Create the media upload plugin */
function createMediaUploadPlugin(options: MediaUploadOptions = {}): Plugin {
  return new Plugin({
    key: mediaUploadKey,

    props: {
      /** Handle file drops */
      handleDrop(view, event, slice, moved) {
        // If content was moved from within the editor, let the default handler deal with it
        if (moved) return false;

        const files = Array.from(event.dataTransfer?.files || []);
        if (files.length === 0) return false;

        // Check if any files are images or videos
        const {
          allowedImageTypes = ['^image/'],
          allowedVideoTypes = ['^video/'],
        } = options;
        const hasMedia = files.some((file) =>
          isImage(file, allowedImageTypes) || isVideo(file, allowedVideoTypes)
        );
        if (!hasMedia) return false;

        // Prevent default drop behavior
        event.preventDefault();

        // Get drop position
        const coords = { left: event.clientX, top: event.clientY };
        const pos = view.posAtCoords(coords);
        if (!pos) return false;

        // Handle the media files
        handleMediaFiles(view, files, pos.pos, options);

        return true;
      },

      /** Handle paste events with images (videos typically don't paste) */
      handlePaste(view, event, slice) {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItems = items.filter((item) =>
          item.type.startsWith('image/')
        );

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
        handleMediaFiles(view, files, from, options);

        return true;
      },
    },
  });
}

/** Extension that adds media upload support via drag & drop and paste */
export class ExtensionMediaUpload extends Extension {
  name = 'mediaUpload';

  constructor(protected config: Partial<MediaUploadOptions> = {}) {
    super(config);
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [createMediaUploadPlugin(this.config)];
  }
}
