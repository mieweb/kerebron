import { toSSG } from 'hono/deno';
import { Server } from './app.ts';
import { build, defineConfig } from 'vite';

const __dirname = import.meta.dirname;

import config from '../vite.config.ts';

await build(config);
