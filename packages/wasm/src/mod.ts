import manifest from './wasm.json' with { type: 'json' };

export function getLangsList(): string[] {
  return manifest
    .map(
      (item) => item.repo.split('-').pop(),
    )
    .filter((item) => 'string' === typeof item);
}

/** Maps language aliases and file extensions to canonical language names. */
const LANG_ALIASES: Record<string, string> = {
  'js': 'javascript',
  'mjs': 'javascript',
  'cjs': 'javascript',
  'ts': 'typescript',
  'mts': 'typescript',
  'cts': 'typescript',
  'sh': 'bash',
  'shell': 'bash',
  'zsh': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
  'htm': 'html',
  'py': 'python',
  'rb': 'ruby',
  'rs': 'rust',
};

/** Resolve a language alias or file extension to its canonical language name. */
export function normalizeLang(lang: string): string {
  return LANG_ALIASES[lang] ?? lang;
}

export function getLangTreeSitter(
  lang: string,
) {
  const langToLoad = normalizeLang(lang);

  const langManifest = manifest.find((item) =>
    item.repo.endsWith('-' + langToLoad)
  );
  if (!langManifest) {
    throw new Error('No grammar for: ' + lang);
  }

  const dir = langManifest.repo.split('/')[1];

  return {
    lang,
    dir,
    repo: langManifest.repo,
    files: langManifest.files,
    queries: langManifest.queries,
  };
}

export async function fetchWasm(wasmUrl: string): Promise<Uint8Array> {
  const response = await fetch(wasmUrl);
  if (response.status >= 400) {
    throw new Error(`Error fetching ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function fetchTextResource(url: string): Promise<string> {
  const responseScm = await fetch(url);
  if (responseScm.status >= 400) {
    throw new Error(`Error fetching ${responseScm.status}`);
  }

  return await responseScm.text();
}

export { manifest };
