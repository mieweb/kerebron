export default function npmResolverPlugin() {
  return {
    name: 'npm-resolver',
    resolveId(source, importer) {
      if (source.startsWith('npm:')) {
        const pkgSource = source.slice(4);
        return this.resolve(pkgSource, importer, { skipSelf: true });
      }
    }
  };
}
