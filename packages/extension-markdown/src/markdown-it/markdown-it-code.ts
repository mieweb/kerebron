// Process `inline code`

function inlineCode(state, silent) {
  const max = state.posMax;
  const start = state.pos;

  if (state.src.charCodeAt(start) !== 0x60 /* ` */) return false;

  let pos = start;
  while (pos < max && state.src.charCodeAt(pos) === 0x60 /* ` */) {
    pos++;
  }

  const marker = state.src.slice(start, pos);
  const markerLen = marker.length;

  if (silent) return true;

  let matchStart = pos;
  let matchEnd = pos;

  while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
    matchEnd = matchStart + 1;

    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60 /* ` */) {
      matchEnd++;
    }

    if (matchEnd - matchStart === markerLen) {
      const content = state.src.slice(pos, matchStart)
        .replace(/\n/g, ' ')
        .replace(/^ (.+) $/, '$1');

      const token_o = state.push('code_open', 'code', 1);
      token_o.markup = marker;

      const token_t = state.push('text', '', 0);
      token_t.content = content;

      const token_c = state.push('code_close', 'code', -1);
      token_c.markup = marker;

      state.pos = matchEnd;
      return true;
    }
  }

  state.pos = start;
  return false;
}

export default function code_plugin(md) {
  // Disable the default code_inline rule
  md.inline.ruler.disable('backticks');

  // Add our custom code rule
  md.inline.ruler.before('emphasis', 'code', inlineCode);
}
