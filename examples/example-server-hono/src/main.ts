import { Server } from './app.ts';

const server = new Server();
Deno.serve(server.fetch);
