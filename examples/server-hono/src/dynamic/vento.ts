import vento from 'ventojs';

const __dirname = import.meta.dirname;

export const ventoEnv = vento({
  includes: __dirname + '/../../tmpl',
});
