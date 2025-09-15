import { Server } from './app.ts';

const server = new Server();
Deno.serve({ port: 80 }, server.fetch);
