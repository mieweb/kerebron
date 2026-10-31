import { CodeCellNodeView } from './NodeViewCodeCell.ts';

export function addToolbar(nodeView: CodeCellNodeView) {
  const toolbar = document.createElement('div');
  nodeView.dom.appendChild(toolbar);

  const button = document.createElement('button');
  button.innerText = 'Run';

  toolbar.appendChild(button);

  button.addEventListener('click', () => {
    const tr = nodeView.view.state.tr;

    tr.setMeta('notebook', {
      nodeView,
      execute: {
        code: nodeView.node.textContent,
      },
    });

    nodeView.view.dispatch(tr);
  });

  return toolbar;
}
