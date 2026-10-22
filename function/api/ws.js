export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const room = url.searchParams.get('room');

  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Dibutuhkan koneksi WebSocket', { status: 400 });
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  server.accept();

  // Inisialisasi/penyimpanan room sederhana di Edge
  if (!globalThis.rooms) globalThis.rooms = new Map();
  if (!globalThis.rooms.has(room)) {
    globalThis.rooms.set(room, []);
  }

  const roomClients = globalThis.rooms.get(room);
  
  if (roomClients.length >= 2) {
    server.close(1008, "Room sudah penuh (Maksimal 2 pemain)");
    return new Response(null, { status: 101, webSocket: client });
  }

  roomClients.push(server);

  // Jika sudah ada 2 pemain, mulai pertandingan
  if (roomClients.length === 2) {
    roomClients.forEach(ws => {
      ws.send(JSON.stringify({ type: 'START' }));
    });
  }

  server.addEventListener('message', event => {
    const data = JSON.parse(event.data);

    // Forward pesan ke lawan
    roomClients.forEach(ws => {
      if (ws !== server) {
        if (data.type === 'STATE_UPDATE') {
          ws.send(JSON.stringify({ type: 'STATE_UPDATE', board: data.board }));
        } else if (data.type === 'ATTACK') {
          ws.send(JSON.stringify({ type: 'GARBAGE', count: data.count }));
        } else if (data.type === 'LOST') {
          ws.send(JSON.stringify({ type: 'OPPONENT_LOST' }));
        }
      }
    });
  });

  server.addEventListener('close', () => {
    const index = roomClients.indexOf(server);
    if (index !== -1) roomClients.splice(index, 1);
    if (roomClients.length === 0) globalThis.rooms.delete(room);
  });

  return new Response(null, { status: 101, webSocket: client });
}
