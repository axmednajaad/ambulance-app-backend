import { createServer } from 'http';
import { Server } from 'socket.io';
import createApp from './app.js';
import socketHandler from './sockets/socket.js';
import { port, server_url } from './config/env_config.js';
// import { PrismaClient } from  '@prisma/client';

// const prisma = new PrismaClient()

// async function testConnection() {
//   try {
//     await prisma.$connect()
//     console.log('✅ Database connection successful')
//     const result = await prisma.$queryRaw`SELECT version()`
//     console.log('PostgreSQL version:', result[0].version)
//   } catch (error) {
//     console.error('❌ Connection failed:', error)
//   } finally {
//     await prisma.$disconnect()
//   }
// }

// testConnection()

try {
  const httpServer = createServer();

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const app = createApp(io);
  httpServer.on('request', app);

  socketHandler(io);

  httpServer.listen(port, () => {
    console.log(`🚀 Server is running on ${server_url}`);
  });
} catch (err) {
  console.error('💥 Top-level crash:', err);
}
