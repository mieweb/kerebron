import { anchorElement, OverLayer } from './mod.ts';

const overLayer = new OverLayer();

// Hover
const anchor = document.createElement('span');
anchor.textContent = 'ANCHOR';

{
  const hover = overLayer.createElement('div');
  anchorElement(hover, anchor);
}

// Multilayer

{
  const hover1 = overLayer.createElement('div');
  anchorElement(hover1, anchor);

  const hover2 = overLayer.createElement('div', hover1);
  anchorElement(hover2, hover1);
}
