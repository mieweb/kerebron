import fs from 'node:fs';
import path from 'node:path';
import debug from 'npm:debug@latest';
import { build, type Loader } from 'npm:esbuild@latest';
import fg from 'npm:fast-glob@latest';
import ts from 'npm:typescript@latest';
// Copyright 2021-2025 Prosopo (UK) Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import type { Plugin } from 'vite';

type FilePath = string;

type ExternalFile<Key extends PropertyKey, Value> = [Key, Value];

type ExternalFiles = Record<FilePath, TsConfig>;

type VitePluginWatchExternalOptions = {
  // path
  workspaceRoot: string;
  // path or glob
  currentPackage: string;
  format: 'esm' | 'cjs';
  // file types to build
  fileTypes?: string[];
  // glob patterns to ignore
  ignorePaths?: string[];
};

const log = debug('vite-plugin-watch-workspace');

const FILE_TYPES = ['ts', 'tsx'];

const RELATIVE_PATH_REGEX = /(\.+\/)*/;

type TsConfig = Record<string, any>;

const getTsConfigFollowExtends = (
  packagePath: string,
  rootDir?: string,
  // biome-ignore lint/suspicious/noExplicitAny: TODO replace any
): TsConfig => {
  // biome-ignore lint/suspicious/noExplicitAny: TODO replace any
  let extendedConfig: TsConfig = {};

  const tsConfigPath = path.resolve(packagePath, 'tsconfig.json');

  let config: TsConfig = {};

  if (fs.existsSync(tsConfigPath)) {
    config = ts.readConfigFile(tsConfigPath, ts.sys.readFile).config;
  }
  if (rootDir) {
    const denoJsonPath = path.resolve(rootDir, 'deno.json');
    if (fs.existsSync(denoJsonPath)) {
      const json = JSON.parse(
        new TextDecoder().decode(fs.readFileSync(denoJsonPath)),
      );
      config = {
        compilerOptions: json.compilerOptions,
      };
    }
  }

  if (config.extends) {
    const importPath = path.resolve(rootDir || '', config.extends);
    const newRootDir = path.dirname(importPath);
    extendedConfig = getTsConfigFollowExtends(importPath, newRootDir);
  }
  return {
    ...extendedConfig,
    ...config,
    compilerOptions: {
      ...extendedConfig.compilerOptions,
      ...config.compilerOptions,
    },
  };
};

const getFilesAndTsConfigs = async (
  workspacePath: string,
  currentPackage: string,
  packageDir: string,
  fileTypes: string[],
  ignorePaths?: string[],
): Promise<ExternalFile<FilePath, TsConfig>[]> => {
  const packagePath = path.resolve(workspacePath, packageDir);

  // check whether the user has passed a glob
  const currentPackageGlob = currentPackage.includes('*')
    ? currentPackage
    : `${currentPackage}/**/*`;
  const tsconfig: TsConfig = getTsConfigFollowExtends(
    packagePath,
    workspacePath,
  );

  const rootDir = tsconfig.compilerOptions.rootDir || './';
  const files = await fg(
    path.resolve(packagePath, `${rootDir}/**/*.(${fileTypes.join('|')})`),
    {
      ignore: [
        '**/node_modules/**',
        currentPackageGlob,
        ...(ignorePaths || []),
      ],
    },
  );
  // keep the tsconfig path beside each file to avoid looking for file ids in arrays later
  return files.map((file: string) => [file, tsconfig]);
};

const getExternalFileLists = async (
  workspaceRoot: string,
  currentPackage: string,
  fileTypes: string[],
  ignorePaths?: string[],
): Promise<ExternalFiles> => {
  const workspaceDenoJson = path.resolve(workspaceRoot, 'deno.json');
  const workspaces = JSON.parse(
    fs.readFileSync(workspaceDenoJson, 'utf8'),
  ).workspace;
  log(workspaces);
  const externalFiles: ExternalFiles = {};
  const filesConfigs: ExternalFile<FilePath, TsConfig>[] = (
    await Promise.all(
      workspaces.map(async (workspace: string) => {
        // get directories in each workspace
        const workspacePath = path.resolve(
          workspaceRoot,
          workspace.replace('*', ''),
        );
        log(workspacePath);
        // get directories in workSpacePath
        const packages = fs
          .readdirSync(workspacePath)
          .filter((dir) =>
            fs.lstatSync(path.join(workspacePath, dir)).isDirectory()
          );
        log('packages', packages);
        // get files and tsconfigs in each package
        return await Promise.all(
          packages.map(
            async (packageDir: string) =>
              await getFilesAndTsConfigs(
                workspacePath,
                currentPackage,
                packageDir,
                fileTypes,
                ignorePaths,
              ),
          ),
        );
      }),
    )
  ).flatMap((filesConfigs) => filesConfigs.flat());
  for (const [file, tsconfig] of filesConfigs) {
    externalFiles[file] = tsconfig;
  }
  return externalFiles;
};

const getLoader = (fileExtension: string) => {
  switch (fileExtension) {
    case '.ts':
      return 'ts';
    case '.tsx':
      return 'tsx';
    case '.js':
      return 'js';
    case '.jsx':
      return 'jsx';
    case '.css':
      return 'css';
    case '.json':
      return 'json';
    case '.vue':
      return 'vue';
    default:
      return 'ts';
  }
};

const getOutExtension = (fileExtension: string) => {
  switch (fileExtension) {
    case '.ts':
      return '.js';
    case '.tsx':
      return '.js';
    case '.js':
      return '.js';
    case '.jsx':
      return '.js';
    case '.css':
      return '.css';
    case '.json':
      return '.json';
    default:
      return '.js';
  }
};

// biome-ignore lint/suspicious/noExplicitAny: TODO replace any
const getOutDir = (file: string, tsconfig: { [key: string]: any }) => {
  const rootFolder = tsconfig.compilerOptions.rootDir?.replace(
    RELATIVE_PATH_REGEX,
    '',
  );
  const outFolder = tsconfig.compilerOptions.outDir?.replace(
    RELATIVE_PATH_REGEX,
    '',
  );
  return path.dirname(file).replace(rootFolder, outFolder);
};

const getOutFile = (outdir: string, file: string, fileExtension: string) => {
  const outExtension = getOutExtension(fileExtension);
  return path.resolve(
    outdir,
    path.basename(file).replace(fileExtension, outExtension),
  );
};

/**
 * Plugin to watch a workspace for changes and rebuild when detected using esbuild
 * @param config
 * The config contains the following parameters
 *  - workspaceRoot: path to the root of the workspace
 *  - currentPackage: path to the current package or glob. Will be transformed to a glob if a path is passed.
 *  - format: esm | cjs
 *  - fileTypes: ts | tsx | js | jsx | ... (optional)
 *  - ignorePaths: paths or globs to ignore (optional)
 * @constructor
 */
export const VitePluginWatchWorkspace = async (
  config: VitePluginWatchExternalOptions,
  // biome-ignore lint/suspicious/noExplicitAny: TODO replace any
): Promise<Plugin<any>> => {
  const externalFiles = await getExternalFileLists(
    config.workspaceRoot,
    config.currentPackage,
    config.fileTypes || FILE_TYPES,
    config.ignorePaths,
  );
  return {
    name: 'vite-plugin-watch-workspace',
    buildStart() {
      Object.keys(externalFiles).map((file) => {
        this.addWatchFile(file);
      });
    },
    async handleHotUpdate({ file, server }) {
      log(`File', ${file}`);

      const tsconfigRaw: TsConfig = externalFiles[file];
      if (!tsconfigRaw) {
        log(`tsconfig not found for file ${file}`);
        return;
      }
      const fileExtension = path.extname(file);
      const loader = getLoader(fileExtension);

      if (!tsconfigRaw.compilerOptions.rootDir) {
        tsconfigRaw.compilerOptions.rootDir = config.currentPackage;
      }
      if (!tsconfigRaw.compilerOptions.outDir) {
        tsconfigRaw.compilerOptions.outDir = config.currentPackage + '/dist';
      }

      const outdir = getOutDir(file, tsconfigRaw);
      const outfile = getOutFile(outdir, file, fileExtension);
      const buildResult = await build({
        tsconfigRaw,
        stdin: {
          contents: fs.readFileSync(file, 'utf8'),
          loader: loader as Loader,
          resolveDir: path.dirname(file),
        },
        outfile,
        platform: config.format === 'cjs' ? 'node' : 'neutral',
        format: config.format || 'esm',
      });
      log(`buildResult', ${JSON.stringify(buildResult)}`);

      server.ws.send({
        type: 'update',
        updates: [
          {
            acceptedPath: file,
            type: 'js-update',
            path: file,
            timestamp: Date.now(),
          },
        ],
      });
    },
  };
};
