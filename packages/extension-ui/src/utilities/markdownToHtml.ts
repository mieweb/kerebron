// TODO: fix this slop

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function markdownToHtml(md: string): string {
  // fenced code blocks first
  let html = md.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_, lang: string = '', code: string) => {
      return `
<pre class="markdown-render"><code class="lang-${escapeHtml(lang)}">${
        escapeHtml(code.trim())
      }</code></pre>`;
    },
  );

  // escape remaining raw html
  html = escapeHtml(html);

  // restore generated tags
  html = html
    .replaceAll('&lt;pre', '<pre')
    .replaceAll('&lt;/pre&gt;', '</pre>')
    .replaceAll('&lt;code', '<code')
    .replaceAll('&lt;/code&gt;', '</code>');

  // inline code
  html = html.replace(
    /`([^`]+)`/g,
    (_, code: string) => `<code>${escapeHtml(code)}</code>`,
  );

  // bold
  html = html.replace(
    /\*\*(.*?)\*\*/g,
    '<strong>$1</strong>',
  );

  // italic
  html = html.replace(
    /\*(.*?)\*/g,
    '<em>$1</em>',
  );

  // links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  );

  // paragraphs
  html = html
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');

  return html;
}
