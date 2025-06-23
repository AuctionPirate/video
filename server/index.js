const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createClient: createSupabase } = require('@supabase/supabase-js');
const { createAdapter } = require('@socket.io/redis-adapter');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { 
    origin: '*', // Allow all origins for testing
    methods: ['GET', 'POST']
  }
});

console.log('REDIS_URL:', process.env.REDIS_URL);

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379',
  socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) }
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('ready', () => console.log('Redis Ready'));

async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Redis Connection Failed:', err);
  }
}
connectRedis();

try {
  const pubClient = redisClient;
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Redis Adapter initialized');
} catch (err) {
  console.error('Redis Adapter Error:', err);
}

const supabase = createSupabase(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('ping', (data) => {
    console.log('Received ping:', data);
    socket.emit('pong', { response: 'Pong from server', received: data });
  });
  socket.on('signal', (data) => socket.to(data.peerId).emit('signal', data));
  socket.on('join-queue', async () => {
    console.log('User joining queue:', socket.id);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .neq('id', socket.id)
      .limit(1);
    if (error) console.error('Supabase Error:', error);
    if (data[0]) {
      socket.join(data[0].id);
      socket.emit('match', { peerId: data[0].id });
      io.to(data[0].id).emit('match', { peerId: socket.id });
    } else {
      await redisClient.lPush('userQueue', socket.id);
    }
  });
  socket.on('next', () => socket.emit('match', { peerId: null }));
});

httpServer.listen(3001, () => console.log('Server on port 3001'));
