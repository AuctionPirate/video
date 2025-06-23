const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('socket.io-redis');
const { createClient } = require('redis');
const { createClient: createSupabase } = require('@supabase/supabase-js');

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: process.env.VERCEL_FRONTEND_URL } });
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);
io.adapter(createAdapter(redisClient));
const supabase = createSupabase(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

io.on('connection', (socket) => {
  socket.on('signal', (data) => socket.to(data.peerId).emit('signal', data));
  socket.on('join-queue', async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .neq('id', socket.id)
      .limit(1);
    if (data[0]) {
      socket.join(data[0].id);
      socket.emit('match', { peerId: data[0].id });
      io.to(data[0].id).emit('match', { peerId: socket.id });
    } else {
      redisClient.lPush('userQueue', socket.id);
    }
  });
  socket.on('next', () => {
    socket.emit('match', { peerId: null });
  });
});

server.listen(3001, () => console.log('Server on port 3001'));
