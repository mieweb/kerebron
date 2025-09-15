export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('npm:')) {
    specifier = specifier.replace('npm:', '');
    console.log('sss', specifier);
  }
  return defaultResolve(specifier, context);
}
