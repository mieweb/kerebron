import path from 'npm:path';
import { copy, exists } from '@std/fs';
import { build, emptyDir } from '@deno/dnt';

const __dirname = import.meta.dirname;

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
    entryPoints.push({
      name,
      path: path.resolve(workspaceRoot, file),
    });
  }

  let configFile = import.meta.resolve('../deno.json');

  if (Deno.args[0]?.replace(/^v/, '')) {
    // Substitute wasm package with npm path. Currently, DNT do not support wasm.
    configFile = await Deno.makeTempFileSync({
      dir: import.meta.dirname + '/..',
      suffix: '.json',
    });
    Deno.writeFileSync(
      configFile,
      new TextEncoder().encode(JSON.stringify(
        {
          ...mainJson,
          workspace: mainJson.workspace.filter((item) =>
            item !== 'packages/odt-wasm'
          ),
          imports: {
            ...mainJson.imports,
            '@kerebron/odt-wasm': 'npm:@kerebron/odt-wasm@latest',
          },
        },
        null,
        2,
      )),
    );
    configFile = 'file:' + configFile;
  }

  try {
    await build({
      entryPoints,
      outDir: path.resolve('./npm', json.name),
      shims: {
        // see JS docs for overview and more options
        deno: true,
      },
      importMap: 'deno.json',
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
    });
  } catch (err) {
    console.error(err);
  }
});
