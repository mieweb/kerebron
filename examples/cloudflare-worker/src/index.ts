export { ChatRoom } from './ChatRoom.ts';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET' && request.url.indexOf('/yjs/') > -1) {
      const roomName = request.url.split('/').pop();

      // Expect to receive a WebSocket Upgrade request.
      // If there is one, accept the request and return a WebSocket Response.
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response(null, {
          status: 426,
          statusText: 'Durable Object expected Upgrade: websocket',
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }

      const id = env.CHAT_ROOM.idFromName(roomName);
      const roomObject = env.CHAT_ROOM.get(id);

      return await roomObject.fetch(request);
    }

    return new Response(null, {
      status: 400,
      statusText: 'Bad Request',
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  },
};
