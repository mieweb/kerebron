import { LspRewriter } from './LspRewriter.ts';

// Deno requires textDocuments to exists on local disk. Therefor they are created in temp dir

export class DenoRewriter implements LspRewriter {
  tempDir: string | undefined;

  init() {
    this.tempDir = Deno.makeTempDirSync();
  }

  destroy() {
    if (this.tempDir) {
      try {
        Deno.removeSync(this.tempDir, { recursive: true });
        // deno-lint-ignore no-empty
      } catch (ignore) {}
    }
  }

  rewriteEditorData(data: string): string {
    try {
      let json = JSON.parse(data);

      if (json.method === 'initialize') {
        if (json?.params?.rootUri) {
          const tempFilePath = this.tempDir + '/deno.json';
          json.params.rootUri = 'file://' + this.tempDir;
          Deno.writeFileSync(tempFilePath, new TextEncoder().encode('{}'));
        }
      }

      const ext =
        (json?.params?.textDocument?.uri || 'default.txt').split('.').pop() ||
        'txt';

      if (json.method === 'textDocument/diagnostic') {
        if (json?.params?.textDocument?.uri) {
          const tempFilePath = this.tempDir + '/' +
            btoa(json?.params?.textDocument?.uri) + '.' + ext;
          json.params.textDocument.uri = 'file://' + tempFilePath;
        }
      }

      if (json.method === 'textDocument/hover') {
        if (json?.params?.textDocument?.uri) {
          const tempFilePath = this.tempDir + '/' +
            btoa(json?.params?.textDocument?.uri) + '.' + ext;
          json.params.textDocument.uri = 'file://' + tempFilePath;
        }
      }

      if (json.method === 'textDocument/didChange') {
        if (json?.params?.textDocument?.uri) {
          const tempFilePath = this.tempDir + '/' +
            btoa(json?.params?.textDocument?.uri) + '.' + ext;
          json.params.textDocument.uri = 'file://' + tempFilePath;
          if (json?.params?.contentChanges) {
            for (const change of json?.params?.contentChanges) {
              if (change.text) {
                Deno.writeFileSync(
                  tempFilePath,
                  new TextEncoder().encode(change.text),
                );
              }
            }
          }
        }
      }

      if (json.method === 'textDocument/didOpen') {
        if (json?.params?.textDocument?.text) {
          const tempFilePath = this.tempDir + '/' +
            btoa(json?.params?.textDocument?.uri) + '.' + ext;
          json.params.textDocument.uri = 'file://' + tempFilePath;
          Deno.writeFileSync(
            tempFilePath,
            new TextEncoder().encode(json?.params?.textDocument?.text),
          );
        }
      }

      data = JSON.stringify(json);
    } catch (err) {
      console.error(err);
    }

    return data;
  }

  rewriteLspData(data: string): string {
    try {
      let json = JSON.parse(data);

      if (json.method === 'textDocument/publishDiagnostics') {
        const prefix = 'file://' + this.tempDir + '/';
        if (json.params?.uri && json.params.uri.startsWith(prefix)) {
          const uri = json.params.uri.substring(prefix.length)
            .replaceAll('%3D', '=')
            .replace(/\.[a-z]+$/, '');
          json.params.uri = atob(uri);
        }
      }
      data = JSON.stringify(json);
    } catch (err) {
      console.error(err);
    }

    return data;
  }
}
