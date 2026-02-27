/**
 * Fetches prebuilt WASM files from tree-sitter-grammars/tree-sitter-markdown
 *
 * Usage:
 *   node scripts/fetch-wasm.js [version]
 *
 * If no version is specified, fetches the latest release.
 * Version can be:
 *   - "latest" (default)
 *   - A specific tag like "v0.5.1"
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { tgz } from 'jsr:@deno-library/compress';

import manifest from './src/wasm.json' with { type: 'json' };

const __dirname = import.meta.dirname!;

async function getLatestRelease(repo: string) {
  console.log('Fetching latest release info...');
  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
  const response = await fetch(apiUrl);
  const release = await response.json();
  return {
    version: release.tag_name,
    assets: (release.assets || []).map((a) => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
    })),
  };
}

async function getReleaseByTag(repo: string, tag: string) {
  console.log(`Fetching release info for ${tag}...`);
  const apiUrl = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
  const response = await fetch(apiUrl);
  const release = await response.json();
  return {
    version: release.tag_name,
    assets: release.assets.map((a) => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
    })),
  };
}

async function downloadFile(url: string, destPath: string) {
  console.log(`  Downloading ${path.basename(destPath)}...`);
  const response = await fetch(url);
  const data = await response.bytes();

  // Create directory if it doesn't exist
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(destPath, data);
  const sizeKB = (data.length / 1024).toFixed(0);
  console.log(`  ✓ Saved ${path.basename(destPath)} (${sizeKB} KB)`);
  return data.length;
}

function verifyWasmFile(filePath: string) {
  const data = fs.readFileSync(filePath);

  // Check WASM magic number: 0x00 0x61 0x73 0x6D (\\0asm)
  if (data.length < 4) {
    throw new Error(`File too small: ${filePath}`);
  }

  if (
    data[0] !== 0x00 || data[1] !== 0x61 || data[2] !== 0x73 || data[3] !== 0x6D
  ) {
    throw new Error(`Invalid WASM magic number in ${filePath}`);
  }

  // Check version (should be 1)
  if (
    data[4] !== 0x01 || data[5] !== 0x00 || data[6] !== 0x00 || data[7] !== 0x00
  ) {
    console.warn(
      `  ⚠ Warning: Unexpected WASM version in ${path.basename(filePath)}`,
    );
  }

  console.log(`  ✓ Verified ${path.basename(filePath)} is valid WASM`);
}

async function main() {
  const args = process.argv.slice(2);
  const mainDestDir = args[0];
  if (!mainDestDir) {
    throw new Error('Dest dir not specified');
  }

  {
    const project = 'odt-wasm';
    const destDir = mainDestDir + '/' + project;
    await Deno.mkdirSync(destDir, { recursive: true });
    await Deno.copyFile(
      __dirname + '/../' + project + '/lib/odt_parser.wasm',
      destDir + '/odt-parser.wasm',
    );
    await Deno.copyFile(
      __dirname + '/../' + project + '/lib-debug/odt_parser.wasm',
      destDir + '/odt-parser-debug.wasm',
    );
  }

  for (const group of manifest) {
    const repo = group.repo;
    const versionArg = (group as any).version || 'latest';
    const files = group.files;
    const queries: Record<string, string> = group.queries;

    const [org, project] = repo.split('/');
    const destDir = mainDestDir + '/' + project;

    Deno.mkdirSync(destDir, { recursive: true });

    console.log('='.repeat(60));
    console.log(
      'Fetching WASM files from ' + repo,
    );
    console.log('='.repeat(60));
    console.log();

    try {
      // Get release info
      const release = versionArg === 'latest'
        ? await getLatestRelease(repo)
        : await getReleaseByTag(repo, versionArg);

      console.log(`Found release: ${release.version}`);
      console.log();

      // Check for required WASM files
      const wasmDir = destDir;
      let totalSize = 0;

      for (const queryName in queries) {
        const queryPath = queries[queryName];
        const queryUrl =
          `https://raw.githubusercontent.com/${repo}/refs/heads/${queryPath}`;

        const destPath = path.join(wasmDir, queryName);
        await downloadFile(queryUrl, destPath);
      }

      for (const wasmFile of files) {
        let asset = release.assets.find((a) => a.name === wasmFile);

        let fileToExtract = '';
        let downloadedFile = wasmFile;
        let wasmFileName = wasmFile;
        if (!asset) {
          if (wasmFile.indexOf('tar.gz/') > -1) {
            const zipFile = wasmFile.substring(
              0,
              wasmFile.indexOf('tar.gz/') + 'tar.gz'.length,
            );
            wasmFileName = wasmFile.substring(
              wasmFile.indexOf('tar.gz/') + 'tar.gz/'.length,
            );

            asset = release.assets.find((a) => a.name === zipFile);
            downloadedFile = zipFile;
            fileToExtract = wasmFileName; //path.join(wasmDir, wasmFileName);
          }
        }
        if (!asset) {
          throw new Error(`${wasmFile} not found in release assets`);
        }

        const destPath = path.join(wasmDir, wasmFileName);
        const downloadPath = path.join(wasmDir, downloadedFile);

        // Check if file already exists
        if (fs.existsSync(destPath)) {
          const existingSize = fs.statSync(destPath).size;
          if (existingSize === asset.size) {
            console.log(
              `  ⊙ ${wasmFile} already up-to-date (${
                (asset.size / 1024).toFixed(0)
              } KB)`,
            );
            totalSize += existingSize;
            continue;
          }
        }

        const size = await downloadFile(asset.url, downloadPath);

        if (fileToExtract) {
          await tgz.uncompress(downloadPath, path.join(wasmDir, 'tar'));
          await Deno.copyFile(
            path.join(wasmDir, 'tar', fileToExtract),
            path.join(wasmDir, fileToExtract),
          );
          await Deno.remove(path.join(wasmDir, 'tar'), { recursive: true });
          await Deno.remove(downloadPath);
        }

        if (destPath.endsWith('.wasm')) {
          await verifyWasmFile(destPath);
        }
        totalSize += size;
      }

      fs.writeFileSync(
        path.join(wasmDir, 'release.json'),
        new TextEncoder().encode(
          JSON.stringify(release, null, 2),
        ),
      );

      console.log();
      console.log('='.repeat(60));
      console.log(`Total WASM size: ${(totalSize / 1024).toFixed(0)} KB`);

      console.log();
      console.log('✓ Done! WASM files are ready.');
      console.log('='.repeat(60));
    } catch (error) {
      console.error(error);
      console.error();
      process.exit(1);
    }
  }
}

await main();
