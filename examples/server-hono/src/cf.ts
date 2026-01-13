import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use(
  '/*',
  cors({
    origin: ['https://kerebron.com'],
    allowMethods: ['GET', 'OPTIONS'],
  }),
);

(await import('./cf/yjs.ts')).install({ app });

export { YjsRoom } from './cf/YjsRoom.ts';

export default app;
