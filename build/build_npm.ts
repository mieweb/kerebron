import * as path from '@std/path';
import { copy, exists } from '@std/fs';
import { build, BuildOptions, emptyDir } from '@deno/dnt';
import { SpecifierMappings } from '@deno/dnt/transform';

const __dirname = import.meta.dirname!;

const allModules: string[] = [];

interface DenoInfoModule {
  kind: 'esm';
  dependencies: Array<{
    specifier: string; // "prosemirror-view"
    code?: {
      error?: string;
      specifier: string; // "npm:prosemirror-view@1.40.0"
      // span unused by me
    };
    type?: {
      error?: string;
      specifier: string; // "npm:prosemirror-view@1.40.0"
      resolutionMode: 'import';
      // span unused by me
    };
  }>;
  local: string; // "/home/packages/editor/src/CoreEditor.ts",
  size: number;
  mediaType: string; // "TypeScript"
  specifier: string; // "file:///home/packages/editor/src/CoreEditor.ts"
}

interface DenoInfo {
  version: number;
  roots: string[];
  modules: Array<DenoInfoModule>;
}

interface DenoJson {
  license: any;
  description: any;
  name: string;
  exports: string | Map<string, string>;
  workspace?: Array<string>;
}

async function getInfo(name: string): Promise<DenoInfo> {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ['info', '--no-npm', '--no-remote', '--json', name],
    stdout: 'piped',
  });

  const out = new TextDecoder().decode(cmd.outputSync().stdout);
  return JSON.parse(out);
}

async function readDenoJson(workspaceRoot: string): Promise<DenoJson> {
  const content = Deno.readFileSync(path.resolve(workspaceRoot, 'deno.json'));
  return JSON.parse(new TextDecoder().decode(content));
}

async function iterateWorkspaces(
  workspaceRoot: string,
  callback: (moduleRoot: string, json: DenoJson) => Promise<void>,
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

async function processModule(moduleRoot: string, json: DenoJson) {
  const version = Deno.args[0]?.replace(/^v/, '');

  const exports = 'string' === typeof json.exports
    ? { '.': json.exports }
    : json.exports;

  if (Object.keys(exports).length === 0) {
    return;
  }

  if (await exists(path.resolve(moduleRoot, 'package.json'))) {
    // Support for WASM which is currently not supported by DNT
    const content = Deno.readFileSync(
      path.resolve(moduleRoot, 'package.json'),
    );
    const packageJson = JSON.parse(new TextDecoder().decode(content));

    console.info(`Copying: ${moduleRoot} (probably wasm)`);

    packageJson.version = version;
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
          path.resolve(moduleRoot, file),
          path.resolve(outDir, file),
        );
      }
    }
    return;
  }

  console.info(`Building: ${moduleRoot}`);

  const entryPoints = [];
  for (const [name, file] of Object.entries(exports)) {
    entryPoints.push({
      name,
      path: path.resolve(moduleRoot, file),
    });
  }

  const configFile = import.meta.resolve('../deno.json');

  const mappings: SpecifierMappings = {};

  const depsMap: Record<string, string> = {};

  const info: DenoInfo = await getInfo(json.name);
  for (const module of info.modules) {
    if (!module.dependencies) {
      continue;
    }
    if (!module.local.startsWith(moduleRoot)) {
      continue;
    }
    for (const dep of module.dependencies) {
      if (dep.specifier.startsWith('@kerebron')) {
        if (dep.code?.error) {
          throw new Error(dep.code.error);
        }
        if (dep.type?.error) {
          throw new Error(dep.type.error);
        }
        if (dep.code?.specifier) {
          depsMap[dep.specifier] = dep.code.specifier.replace('file:///', '/');
        }
        if (dep.type?.specifier) {
          depsMap[dep.specifier] = dep.type.specifier.replace('file:///', '/');
        }
      }
    }
  }

  for (const [subName, localPath] of Object.entries(depsMap)) {
    const name = allModules.find((m) => subName.startsWith(m));
    if (!name) {
      continue;
    }
    if (name === json.name) {
      continue;
    }
    const subPath = subName.substring(name.length + 1) || undefined;

    mappings[localPath] = {
      name,
      subPath,
      version: version,
    };
  }

  const opts: BuildOptions = {
    importMap: './import_map.npm.json',
    entryPoints,
    outDir: path.resolve('./npm', json.name),
    shims: {
      // see JS docs for overview and more options
      deno: 'dev',
    },
    skipNpmInstall: true,
    // importMap: path.resolve(workspaceRoot, 'deno.json'),
    package: {
      // package.json properties
      name: json.name,
      version,
      description: json.description || mainJson.description,
      license: json.license || mainJson.license,
    },
    configFile,
    async postBuild() {
      Deno.copyFileSync('LICENSE', path.resolve('npm', json.name, 'LICENSE'));
      Deno.copyFileSync(
        'README.md',
        path.resolve('npm', json.name, 'README.md'),
      );
      if (await exists(path.resolve(moduleRoot, 'README.md'))) {
        Deno.copyFileSync(
          path.resolve(moduleRoot, 'README.md'),
          path.resolve('npm', json.name, 'README.md'),
        );
      }
      if (await exists(path.resolve(moduleRoot, 'assets'))) {
        await copy(
          path.resolve(moduleRoot, 'assets'),
          path.resolve('npm', json.name, 'assets'),
          { overwrite: true, preserveTimestamps: true },
        );
      }
    },
    mappings,
    compilerOptions: {
      lib: ['ES2021'],
    },
    typeCheck: false,
    test: false,
    scriptModule: false,
  };

  if (await exists(path.resolve(moduleRoot, 'assets', 'index.css'))) {
    opts.package.style = 'assets/index.css';
  }

  try {
    await build(opts);
  } catch (err) {
    if (
      'string' === typeof err &&
      err.indexOf('Not implemented support for Wasm modules') > -1
    ) {
      console.warn(err);
      return;
    }
    console.error(err);
    Deno.exit(1);
  }
}

const workspaceRoot = path.resolve(__dirname, '..');
const mainJson = await readDenoJson(workspaceRoot);

const allModuleSet: Set<string> = new Set();
await iterateWorkspaces(workspaceRoot, async (moduleRoot, json) => {
  if (!json.name.startsWith('@kerebron')) {
    return;
  }
  allModuleSet.add(json.name);
});

allModules.push(
  ...Array.from(allModuleSet).sort((a, b) => b.length - a.length),
);

await emptyDir('./npm');

await iterateWorkspaces(workspaceRoot, async (moduleRoot, json) => {
  await processModule(moduleRoot, json);
});
