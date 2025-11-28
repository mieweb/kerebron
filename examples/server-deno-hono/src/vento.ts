import vento from 'npm:ventojs@latest';

const __dirname = import.meta.dirname;

export const ventoEnv = vento({
  includes: __dirname + '/../tmpl',
});
