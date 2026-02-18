import type { Node as PmNode, NodeSpec } from 'prosemirror-model';
import { Selection } from 'prosemirror-state';
import type { EditorView, NodeViewConstructor } from 'prosemirror-view';

import { Node } from '@kerebron/editor';
import type { CoreEditor } from '@kerebron/editor';

export class NodeImage extends Node {
  override name = 'image';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
        width: { default: null },
        height: { default: null },
        origUrl: { default: undefined },
      },
      group: 'inline',
      draggable: true,
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs(dom: HTMLElement) {
            return {
              src: dom.getAttribute('src'),
              title: dom.getAttribute('title'),
              alt: dom.getAttribute('alt'),
              width: dom.getAttribute('width') || dom.style.width || null,
              height: dom.getAttribute('height') || dom.style.height || null,
            };
          },
        },
      ],
      toDOM(node) {
        const { src, alt, title, width, height } = node.attrs;
        const attrs: Record<string, string> = { src };
        if (alt) attrs.alt = alt;
        if (title) attrs.title = title;
        if (width) attrs.width = width;
        if (height) attrs.height = height;
        return ['img', attrs];
      },
    };
  }

  override getNodeView(editor: CoreEditor): NodeViewConstructor {
    return (node: PmNode, view: EditorView, getPos) => {
      // Create wrapper div for the image with resize handles
      const wrapper = document.createElement('span');
      wrapper.className = 'kb-image-wrapper';
      wrapper.contentEditable = 'false';

      // Create the image element
      const img = document.createElement('img');
      img.src = node.attrs.src;
      if (node.attrs.alt) img.alt = node.attrs.alt;
      if (node.attrs.title) img.title = node.attrs.title;
      if (node.attrs.width) {
        img.style.width = typeof node.attrs.width === 'number'
          ? `${node.attrs.width}px`
          : node.attrs.width;
      }
      if (node.attrs.height) {
        img.style.height = typeof node.attrs.height === 'number'
          ? `${node.attrs.height}px`
          : node.attrs.height;
      }
      img.draggable = false;

      wrapper.appendChild(img);

      // Create resize handles
      const positions = ['nw', 'ne', 'sw', 'se'] as const;
      const handles: HTMLElement[] = [];

      for (const pos of positions) {
        const handle = document.createElement('span');
        handle.className =
          `kb-image-resize-handle kb-image-resize-handle-${pos}`;
        handle.dataset.position = pos;
        handles.push(handle);
        wrapper.appendChild(handle);
      }

      let isResizing = false;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;
      let aspectRatio = 1;
      let activeHandle: string | null = null;

      const onMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('kb-image-resize-handle')) return;

        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        activeHandle = target.dataset.position || null;
        startX = e.clientX;
        startY = e.clientY;

        const rect = img.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        aspectRatio = startWidth / startHeight;

        wrapper.classList.add('kb-image-resizing');

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        // Calculate new dimensions based on which handle is being dragged
        switch (activeHandle) {
          case 'se':
            newWidth = startWidth + deltaX;
            newHeight = e.shiftKey
              ? startHeight + deltaY
              : newWidth / aspectRatio;
            break;
          case 'sw':
            newWidth = startWidth - deltaX;
            newHeight = e.shiftKey
              ? startHeight + deltaY
              : newWidth / aspectRatio;
            break;
          case 'ne':
            newWidth = startWidth + deltaX;
            newHeight = e.shiftKey
              ? startHeight - deltaY
              : newWidth / aspectRatio;
            break;
          case 'nw':
            newWidth = startWidth - deltaX;
            newHeight = e.shiftKey
              ? startHeight - deltaY
              : newWidth / aspectRatio;
            break;
        }

        // Ensure minimum size
        newWidth = Math.max(50, newWidth);
        newHeight = Math.max(50, newHeight);

        img.style.width = `${Math.round(newWidth)}px`;
        img.style.height = `${Math.round(newHeight)}px`;
      };

      const onMouseUp = () => {
        if (!isResizing) return;

        isResizing = false;
        activeHandle = null;
        wrapper.classList.remove('kb-image-resizing');

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Get the new dimensions and update the node
        const newWidth = Math.round(img.getBoundingClientRect().width);
        const newHeight = Math.round(img.getBoundingClientRect().height);

        const pos = getPos();
        if (typeof pos === 'number') {
          const tr = view.state.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            width: `${newWidth}px`,
            height: `${newHeight}px`,
          });
          view.dispatch(tr);
        }
      };

      wrapper.addEventListener('mousedown', onMouseDown);

      // Add click handler to select the image
      wrapper.addEventListener('click', (e) => {
        e.preventDefault();
        const pos = getPos();
        if (typeof pos === 'number') {
          const $pos = view.state.doc.resolve(pos);
          const selection = Selection.near($pos);
          view.dispatch(view.state.tr.setSelection(selection));
        }
      });

      return {
        dom: wrapper,
        update: (updatedNode: PmNode) => {
          if (updatedNode.type.name !== 'image') return false;

          img.src = updatedNode.attrs.src;
          if (updatedNode.attrs.alt) img.alt = updatedNode.attrs.alt;
          if (updatedNode.attrs.title) img.title = updatedNode.attrs.title;
          if (updatedNode.attrs.width) {
            img.style.width = typeof updatedNode.attrs.width === 'number'
              ? `${updatedNode.attrs.width}px`
              : updatedNode.attrs.width;
          } else {
            img.style.width = '';
          }
          if (updatedNode.attrs.height) {
            img.style.height = typeof updatedNode.attrs.height === 'number'
              ? `${updatedNode.attrs.height}px`
              : updatedNode.attrs.height;
          } else {
            img.style.height = '';
          }

          return true;
        },
        destroy: () => {
          wrapper.removeEventListener('mousedown', onMouseDown);
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        },
        stopEvent: (event: Event) => {
          // Allow selection events to pass through
          return event.type === 'mousedown' &&
            (event.target as HTMLElement).classList.contains(
              'kb-image-resize-handle',
            );
        },
        ignoreMutation: () => true,
      };
    };
  }
}
