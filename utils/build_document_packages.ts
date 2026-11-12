import { build } from '@deno/dnt';
import type { SpecifierMappings } from '@deno/dnt/transform';

const version = Deno.args[0] ?? '0.9.2-mvp.0';
const root = new URL('../', import.meta.url);
const mappings: SpecifierMappings = {
  [new URL('packages/documents/src/mod.ts', root).href]: {
    name: '@kerebron/documents',
    version,
  },
};
for (
  const [subPath, file] of [
    ['', 'mod.ts'],
    ['commands', 'commands/mod.ts'],
    ['user', 'user/mod.ts'],
  ] as const
) {
  mappings[new URL('packages/editor/src/' + file, root).href] = {
    name: '@kerebron/editor',
    version: '0.8.12',
    subPath: subPath || undefined,
  };
}
for (const name of ['documents', 'document-mime', 'document-yjs']) {
  const outDir = new URL('npm/@kerebron/' + name, root).pathname;
  const packageMappings = { ...mappings };
  for (const [specifier] of Object.entries(packageMappings)) {
    if (name !== 'document-yjs' && specifier.includes('/packages/editor/')) {
      delete packageMappings[specifier];
    }
    if (name === 'document-yjs' && specifier.includes('/packages/documents/')) {
      delete packageMappings[specifier];
    }
  }
  if (name === 'documents') {
    delete packageMappings[new URL('packages/documents/src/mod.ts', root).href];
  }
  await build({
    entryPoints: [new URL('packages/' + name + '/src/mod.ts', root).pathname],
    outDir,
    configFile: new URL('deno.json', root).href,
    mappings: packageMappings,
    shims: {},
    skipNpmInstall: true,
    typeCheck: false,
    test: false,
    scriptModule: false,
    compilerOptions: {
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      target: 'ES2022',
    },
    package: {
      name: '@kerebron/' + name,
      version,
      license: 'MIT',
      description:
        'Experimental host-owned document editing integration for Kerebron.',
      files: ['esm', 'src', 'LICENSE', 'README.md'],
    },
    async postBuild() {
      await Deno.copyFile(new URL('LICENSE', root), outDir + '/LICENSE');
      await Deno.copyFile(
        new URL('packages/' + name + '/README.md', root),
        outDir + '/README.md',
      );
      if (name !== 'document-yjs') return;
      const packageJson = JSON.parse(
        await Deno.readTextFile(outDir + '/package.json'),
      );
      packageJson.peerDependencies = {};
      for (
        const dependency of [
          '@kerebron/editor',
          '@kerebron/extension-basic-editor',
          'prosemirror-model',
          'prosemirror-state',
          'prosemirror-view',
          'prosemirror-transform',
          'yjs',
          'y-protocols',
          'lib0',
        ]
      ) {
        if (packageJson.dependencies?.[dependency]) {
          packageJson.peerDependencies[dependency] =
            dependency.startsWith('@kerebron/')
              ? '>=0.8.12'
              : dependency.startsWith('prosemirror-')
              ? '^1.0.0'
              : dependency === 'yjs'
              ? '^13.6.30'
              : '^' + packageJson.dependencies[dependency];
          delete packageJson.dependencies[dependency];
        }
      }
      await Deno.writeTextFile(
        outDir + '/package.json',
        JSON.stringify(packageJson, null, 2) + '\n',
      );
    },
  });
}
