import { Server } from './app.ts';

const __dirname = import.meta.dirname;

const server = new Server();
Deno.serve({ port: 80 }, server.fetch);
