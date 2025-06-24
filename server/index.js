const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Adjust for production
    methods: ['GET', 'POST'],
  },
});

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379',
  socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) },
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Redis Connection Failed:', err);
  }
}
connectRedis();

const pubClient = redisClient;
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join-queue', async () => {
    console.log('User joining queue:', socket.id);
    // Try to pop a waiting user from the queue
    const queuedUser = await redisClient.rPop('userQueue');
    if (queuedUser && queuedUser !== socket.id && io.sockets.sockets.get(queuedUser)) {
      // Verify the queued user is still connected
      socket.join(queuedUser);
      socket.emit('match', { peerId: queuedUser });
      io.to(queuedUser).emit('match', { peerId: socket.id });
      console.log(`Matched ${socket.id} with ${queuedUser}`);
    } else {
      // No match found, add to queue
      await redisClient.lPush('userQueue', socket.id);
      console.log(`Added ${socket.id} to queue`);
    }
  });

  socket.on('signal', (data) => {
    socket.to(data.peerId).emit('signal', data);
  });

  socket.on('next', async () => {
    // Reset client state and re-queue
    socket.emit('match', { peerId: null });
    // Re-queue the user
    const queuedUser = await redisClient.rPop('userQueue');
    if (queuedUser && queuedUser !== socket.id && io.sockets.sockets.get(queuedUser)) {
      socket.join(queuedUser);
      socket.emit('match', { peerId: queuedUser });
      io.to(queuedUser).emit('match', { peerId: socket.id });
      console.log(`Matched ${socket.id} with ${queuedUser} after next`);
    } else {
      await redisClient.lPush('userQueue', socket.id);
      console.log(`Re-added ${socket.id} to queue after next`);
    }
  });

  socket.on('disconnect', async () => {
    console.log('Socket disconnected:', socket.id);
    // Remove from queue if present
    await redisClient.lRem('userQueue', 0, socket.id);
  });

  socket.on('ping', (data) => {
    socket.emit('pong', { response: 'Pong from server', received: data });
  });
});

httpServer.listen(3001, () => console.log('Server on port 3001'));
