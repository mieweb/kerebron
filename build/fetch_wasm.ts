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

const REPO = 'tree-sitter-grammars/tree-sitter-markdown';
const WASM_FILES = [
  'tree-sitter-markdown.wasm',
  'tree-sitter-markdown_inline.wasm',
];

async function getLatestRelease() {
  console.log('Fetching latest release info...');
  const apiUrl = `https://api.github.com/repos/${REPO}/releases/latest`;
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

async function getReleaseByTag(tag: string) {
  console.log(`Fetching release info for ${tag}...`);
  const apiUrl = `https://api.github.com/repos/${REPO}/releases/tags/${tag}`;
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

async function verifyWasmFile(filePath: string) {
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
  const destDir = args[0];
  if (!destDir) {
    throw new Error('Dest dir not specified');
  }

  const versionArg = args[1] || 'latest';

  console.log('='.repeat(60));
  console.log(
    'Fetching WASM files from tree-sitter-grammars/tree-sitter-markdown',
  );
  console.log('='.repeat(60));
  console.log();

  try {
    // Get release info
    const release = versionArg === 'latest'
      ? await getLatestRelease()
      : await getReleaseByTag(versionArg);

    console.log(`Found release: ${release.version}`);
    console.log();

    // Check for required WASM files
    const wasmDir = destDir;
    let totalSize = 0;

    for (const wasmFile of WASM_FILES) {
      const asset = release.assets.find((a) => a.name === wasmFile);

      if (!asset) {
        console.error(`  ✗ ${wasmFile} not found in release assets`);
        continue;
      }

      const destPath = path.join(wasmDir, wasmFile);

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

      const size = await downloadFile(asset.url, destPath);
      await verifyWasmFile(destPath);
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

await main();
