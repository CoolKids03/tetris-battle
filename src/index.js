export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/ws') {
      const roomCode = url.searchParams.get('room') || 'default';
      const id = env.ROOM_DO.idFromName(roomCode.toUpperCase());
      const stub = env.ROOM_DO.get(id);
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};

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

    if (this.sessions.length === 2) {
      this.broadcast({ type: 'START' });
    }

    server.addEventListener('message', event => {
      try {
        const data = JSON.parse(event.data);
        
        // Broadcast aman ke session lain (membersihkan sesi mati secara otomatis)
        this.sessions = this.sessions.filter(session => {
          if (session === server) return true;
          try {
            session.send(JSON.stringify(data));
            return true;
          } catch (e) {
            return false; // Hapus sesi yang terputus
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
    this.sessions = this.sessions.filter(session => {
      try {
        session.send(msgStr);
        return true;
      } catch (e) {
        return false;
      }
    });
  }
}
