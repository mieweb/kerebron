import * as path from '@std/path';
import { copy, exists } from '@std/fs';
import { build, emptyDir } from '@deno/dnt';

const __dirname = import.meta.dirname;

// Check if running directly without the build script
if (!Deno.args[0]) {
  console.error(`
╔════════════════════════════════════════════════════════════════════╗
║  ERROR: Version argument required                                  ║
╠════════════════════════════════════════════════════════════════════╣
║  This script should be run via the build script:                   ║
║                                                                    ║
║    ./scripts/build-and-publish-npm.sh <version>                    ║
║                                                                    ║
║  Example:                                                          ║
║    ./scripts/build-and-publish-npm.sh 1.0.0                        ║
║    ./scripts/build-and-publish-npm.sh 1.0.0 --publish              ║
║                                                                    ║
║  The build script ensures prerequisites (WASM, etc.) are built     ║
║  before running this npm package transform.                        ║
╚════════════════════════════════════════════════════════════════════╝
`);
  Deno.exit(1);
}

interface DenoJson {
  license: any;
  description: any;
  name: string;
  exports: string | Map<string, string>;
}

async function readDenoJson(workspaceRoot: string) {
  const content = Deno.readFileSync(path.resolve(workspaceRoot, 'deno.json'));
  return JSON.parse(new TextDecoder().decode(content));
}

async function iterateWorkspaces(
  workspaceRoot: string,
  callback: (workspaceRoot: string, json: DenoJson) => Promise<void>,
): Promise<void> {
  const json = await readDenoJson(workspaceRoot);
  if (json.workspace) {
    for (const pack of json.workspace) {
      await iterateWorkspaces(path.resolve(workspaceRoot, pack), callback);
    }
  }
  if (json.name && json.exports) {
    await callback(workspaceRoot, json);
  }
}

const workspaceRoot = path.resolve(__dirname, '..');
const mainJson = await readDenoJson(workspaceRoot);

await emptyDir('./npm');

// Track build results
const buildResults: { name: string; success: boolean; error?: string }[] = [];

// Create temp config file once (for substituting wasm package with npm path)
let tempConfigFile: string | null = null;
let configFile = import.meta.resolve('../deno.json');
let importMapFile = 'deno.json';

if (Deno.args[0]?.replace(/^v/, '')) {
  // Substitute wasm package with npm path. Currently, DNT does not support wasm.
  // Also substitute deno_tree_sitter with local shims that wrap web-tree-sitter.
  tempConfigFile = Deno.makeTempFileSync({
    dir: __dirname + '/..',
    suffix: '.build.json',
  });

  // Create modified imports: remove the $deno_tree_sitter/ prefix mapping
  // and add individual path mappings to local shims
  const modifiedImports = { ...mainJson.imports };
  delete modifiedImports['$deno_tree_sitter/'];

  Deno.writeFileSync(
    tempConfigFile,
    new TextEncoder().encode(JSON.stringify(
      {
        ...mainJson,
        workspace: mainJson.workspace.filter((item: string) =>
          item !== 'packages/odt-wasm'
        ),
        imports: {
          ...modifiedImports,
          '@kerebron/odt-wasm': 'npm:@kerebron/odt-wasm@latest',
          // Map deno_tree_sitter to local shims that wrap web-tree-sitter
          '$deno_tree_sitter/main.js':
            './packages/tree-sitter-shim/src/main.ts',
          '$deno_tree_sitter/tree_sitter/parser.ts':
            './packages/tree-sitter-shim/src/tree_sitter/parser.ts',
          '$deno_tree_sitter/tree_sitter/parser.js':
            './packages/tree-sitter-shim/src/tree_sitter/parser.ts',
          '$deno_tree_sitter/tree_sitter/tree.ts':
            './packages/tree-sitter-shim/src/tree_sitter/tree.ts',
          '$deno_tree_sitter/tree_sitter/node.ts':
            './packages/tree-sitter-shim/src/tree_sitter/node.ts',
          '$deno_tree_sitter/tree_sitter/language.js':
            './packages/tree-sitter-shim/src/tree_sitter/language.ts',
        },
      },
      null,
      2,
    )),
  );
  configFile = 'file:' + tempConfigFile;
  importMapFile = tempConfigFile;
}

async function copyRecursive(src: string, dest: string) {
  const stat = await Deno.lstat(src);

  if (stat.isFile) {
    await Deno.copyFile(src, dest);
  } else if (stat.isDirectory) {
    await Deno.mkdir(dest, { recursive: true });

    for await (const entry of Deno.readDir(src)) {
      const srcPath = `${src}/${entry.name}`;
      const destPath = `${dest}/${entry.name}`;
      await copyRecursive(srcPath, destPath);
    }
  } else if (stat.isSymlink) {
    const target = await Deno.readLink(src);
    await Deno.symlink(target, dest);
  } else {
    console.warn(`Skipping unsupported file type: ${src}`);
  }
}

await iterateWorkspaces(workspaceRoot, async (workspaceRoot, json) => {
  const exports = 'string' === typeof json.exports
    ? { '.': json.exports }
    : json.exports;

  if (Object.keys(exports).length === 0) {
    return;
  }

  if (await exists(path.resolve(workspaceRoot, 'package.json'))) {
    // Support for WASM which is currently not supported by DNT
    const content = Deno.readFileSync(
      path.resolve(workspaceRoot, 'package.json'),
    );
    const packageJson = JSON.parse(new TextDecoder().decode(content));

    console.info(`Copying: ${workspaceRoot} (probably wasm)`);

    packageJson.version = Deno.args[0]?.replace(/^v/, '');
    packageJson.description = packageJson.description || mainJson.description;
    packageJson.license = packageJson.license || mainJson.license;

    const outDir = path.resolve('./npm', json.name);

    Deno.mkdirSync(outDir, { recursive: true });

    Deno.writeFileSync(
      path.resolve(outDir, 'package.json'),
      new TextEncoder().encode(JSON.stringify(packageJson, null, 2)),
    );

    if (Array.isArray(packageJson.files)) {
      for (const file of packageJson.files) {
        await copyRecursive(
          path.resolve(workspaceRoot, file),
          path.resolve(outDir, file),
        );
      }
    }
    return;
  }

  console.info(`Building: ${workspaceRoot}`);

  const entryPoints = [];
  for (const [name, file] of Object.entries(exports)) {
    // Skip CSS files - they are copied separately in postBuild
    if (file.endsWith('.css')) {
      continue;
    }
    entryPoints.push({
      name,
      path: path.resolve(workspaceRoot, file),
    });
  }

  try {
    const opts = {
      entryPoints,
      outDir: path.resolve('./npm', json.name),
      shims: {
        // Use "dev" to only include Deno shims for testing, not in production.
        // The @deno/shim-deno package contains Node.js-specific code (like os.platform())
        // that doesn't work in browsers. Since the library code doesn't actually use
        // Deno APIs (except in runtime-conditional checks), we only need the shim for tests.
        deno: 'dev' as const,
      },
      importMap: importMapFile,
      package: {
        // package.json properties
        name: json.name,
        version: Deno.args[0]?.replace(/^v/, ''),
        description: json.description || mainJson.description,
        license: json.license || mainJson.license,
      },
      configFile: configFile,
      async postBuild() {
        Deno.copyFileSync('LICENSE', path.resolve('npm', json.name, 'LICENSE'));
        Deno.copyFileSync(
          'README.md',
          path.resolve('npm', json.name, 'README.md'),
        );
        if (await exists(path.resolve(workspaceRoot, 'README.md'))) {
          Deno.copyFileSync(
            path.resolve(workspaceRoot, 'README.md'),
            path.resolve('npm', json.name, 'README.md'),
          );
        }
        if (await exists(path.resolve(workspaceRoot, 'assets'))) {
          await copy(
            path.resolve(workspaceRoot, 'assets'),
            path.resolve('npm', json.name, 'assets'),
            { overwrite: true, preserveTimestamps: true },
          );
        }
      },
      mappings: {},
      compilerOptions: {
        lib: ['ES2021'],
      },
      typeCheck: false,
      test: false,
      scriptModule: false,
    };

    if (await exists(path.resolve(workspaceRoot, 'assets', 'index.css'))) {
      opts['style'] = 'assets/index.css';
    }

    await build(opts);
    buildResults.push({ name: json.name, success: true });
  } catch (err) {
    console.error(err);
    buildResults.push({ name: json.name, success: false, error: String(err) });
  }
});

// Report build results
console.log('\n========================================');
console.log('  Build Summary');
console.log('========================================');

const successful = buildResults.filter((r) => r.success);
const failed = buildResults.filter((r) => !r.success);

if (successful.length > 0) {
  console.log(`\n✓ Successfully built (${successful.length}):`);
  for (const result of successful) {
    console.log(`  - ${result.name}`);
  }
}

if (failed.length > 0) {
  console.log(`\n✗ Failed to build (${failed.length}):`);
  for (const result of failed) {
    console.log(`  - ${result.name}`);
  }
  console.log('\n========================================');
  console.error(`\nBuild failed: ${failed.length} package(s) failed to build`);

  // Cleanup temp config file before exit
  if (tempConfigFile) {
    try {
      Deno.removeSync(tempConfigFile);
    } catch {
      // Ignore cleanup errors
    }
  }
  Deno.exit(1);
}

console.log('\n========================================');
console.log(`\nAll ${successful.length} packages built successfully!`);

// Cleanup temp config file
if (tempConfigFile) {
  try {
    Deno.removeSync(tempConfigFile);
  } catch {
    // Ignore cleanup errors
  }
}
