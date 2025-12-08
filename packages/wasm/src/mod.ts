import manifest from '../wasm.json' with { type: 'json' };

export function getLangsList(): string[] {
  return manifest
    .map(
      (item) => item.repo.split('-').pop(),
    )
    .filter((item) => 'string' === typeof item);
}

export function getLangTreeSitter(
  lang: string,
  cdnUrl = 'http://localhost:8000/wasm/',
) {
  const langManifest = manifest.find((item) => item.repo.endsWith('-' + lang));
  if (!langManifest) {
    throw new Error('No grammar for: ' + lang);
  }

  if (!cdnUrl.endsWith('/')) {
    cdnUrl += '/';
  }

  const dir = langManifest.repo.split('/')[1];
  cdnUrl += dir + '/';

  const queries = Object.entries(langManifest.queries)
    .map((entry) => [entry[0], cdnUrl + entry[0]]);

  return {
    lang,
    repo: langManifest.repo,
    files: langManifest.files.map((file) => cdnUrl + file),
    queries: Object.fromEntries(queries),
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
