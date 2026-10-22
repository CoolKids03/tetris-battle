export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Tangani koneksi WebSocket / Room
    if (url.pathname === '/api/ws') {
      const roomCode = url.searchParams.get('room') || 'default';
      
      // Ambil ID Durable Object berdasarkan Nama/Kode Room
      const id = env.ROOM_DO.idFromName(roomCode.toUpperCase());
      const stub = env.ROOM_DO.get(id);

      // Teruskan request WebSocket ke Durable Object room tersebut
      return stub.fetch(request);
    }

    // Sajikan file statis web dari folder public
    return env.ASSETS.fetch(request);
  }
};

// Durable Object untuk mengelola Room secara terpusat
export class TetrisRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = [];
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Dibutuhkan koneksi WebSocket', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.sessions.push(server);

    // Jika sudah ada 2 pemain di room ini, mulai game untuk keduanya
    if (this.sessions.length === 2) {
      this.broadcast({ type: 'START' });
    }

    server.addEventListener('message', event => {
      try {
        const data = JSON.parse(event.data);
        // Teruskan pesan ke pemain lain di room yang sama
        this.sessions.forEach(session => {
          if (session !== server) {
            session.send(JSON.stringify(data));
          }
        });
      } catch (err) {
        console.error(err);
      }
    });

    server.addEventListener('close', () => {
      this.sessions = this.sessions.filter(s => s !== server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(message) {
    const msgStr = JSON.stringify(message);
    this.sessions.forEach(session => session.send(msgStr));
  }
}
