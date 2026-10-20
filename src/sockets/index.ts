import { Server } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './socketAuth';
import { registerChatHandlers } from './chatHandler';
import { registerStoreHandlers } from './storeHandler';

export const initializeSocketServer = (io: Server) => {
  // Apply token authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    console.log(`[Socket Connected] User ${user.full_name} (${user.id}) | Role: ${user.role} | Socket ID: ${socket.id}`);

    // Join personal user room for direct alerts & notifications
    socket.join(`user:${user.id}`);

    // If shop owner, also join merchant room
    if (user.role === 'shop_owner' || user.role === 'superadmin') {
      socket.join(`store_owner:${user.id}`);
    }

    // Register modular feature handlers
    registerChatHandlers(io, socket);
    registerStoreHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket Disconnected] User ${user.full_name} (${user.id}) | Reason: ${reason}`);
    });
  });
};
