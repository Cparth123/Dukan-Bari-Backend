const { Server } = require('socket.io');
const { verifyToken } = require('../middleware/auth');
const { Message, Conversation, Store } = require('../models');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
  });

  // Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        socket.user = decoded;
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    const userDesc = socket.user ? `${socket.user.role}:${socket.user.id}` : 'Guest';
    console.log(`[Socket.io] Client connected: ${socket.id} (${userDesc})`);

    // Auto-join personal user room if authenticated
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
      if (socket.user.role === 'dukandar') {
        Store.findByOwnerId(socket.user.id).then(st => {
          if (st) {
            socket.join(`store:${st.id}`);
            console.log(`[Socket.io] Auto-joined store room store:${st.id} for dukandar ${socket.user.id}`);
          }
        }).catch(() => {});
      }
    }

    // Dukandar auto-joins their store room
    socket.on('join_store', (storeId) => {
      if (storeId) {
        socket.join(`store:${storeId}`);
        console.log(`[Socket.io] ${socket.id} joined store:${storeId}`);
      }
    });

    // 1. Join Chat Conversation Room
    socket.on('join_conversation', (conversationId) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
        console.log(`[Socket.io] ${socket.id} joined conversation:${conversationId}`);
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // 2. Real-time Message Exchange
    socket.on('send_message', async (data, ack) => {
      try {
        const { conversation_id, text, media_url, media_type } = data;
        if (!conversation_id || (!text && !media_url)) {
          if (ack) ack({ success: false, error: 'Invalid message payload' });
          return;
        }

        const senderId = socket.user?.id || data.sender_id || 'guest_user';
        const senderRole = socket.user?.role || data.sender_role || 'customer';

        const newMsg = Message.sanitize({
          id: data.id || undefined,
          conversation_id,
          sender_id: senderId,
          sender_role: senderRole,
          text: text || '',
          content: text || '',
          media_url: media_url || null,
          media_type: media_type || 'none'
        });

        // 1. Immediately broadcast to conversation room (single canonical broadcast)
        io.to(`conversation:${conversation_id}`).emit('new_message', newMsg);
        if (ack) ack({ success: true, message: newMsg });

        // 2. Persist message and update last message concurrently in Cloud SQL
        Message.create(newMsg).catch(e => console.warn('[Socket] Message save error:', e.message));
        Conversation.updateLastMessage(conversation_id, {
          text: text || (media_type === 'image' ? '📷 Photo' : '🎥 Video'),
          senderRole
        }).catch(() => {});

        // 3. Notify store channel and user channel with background alert notification & live message
        Conversation.findById(conversation_id).then(conv => {
          if (conv) {
            io.to(`store:${conv.store_id}`).emit('new_message', newMsg);
            io.to(`store:${conv.store_id}`).emit('chat_notification', {
              conversation_id,
              message: newMsg
            });
            io.to(`user:${conv.customer_id}`).emit('chat_notification', {
              conversation_id,
              message: newMsg
            });
          }
        }).catch(() => {});
      } catch (err) {
        console.error('[Socket.io] send_message error:', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    // 3. Typing Indicators
    socket.on('typing', ({ conversation_id, userName }) => {
      socket.to(`conversation:${conversation_id}`).emit('user_typing', {
        conversation_id,
        userName: userName || socket.user?.full_name || 'Someone'
      });
    });

    socket.on('stop_typing', ({ conversation_id }) => {
      socket.to(`conversation:${conversation_id}`).emit('user_stop_typing', { conversation_id });
    });

    // 4. Join Hyperlocal Radar
    socket.on('join_radar', () => {
      socket.join('radar');
    });

    // 5. Merchant Live Status Toggle (Real-time Broadcast)
    socket.on('toggle_store_status', async ({ storeId, isOpen }) => {
      try {
        const nextOpen = Boolean(isOpen);
        await Store.toggleLiveStatus(storeId, nextOpen);
        const payload = {
          storeId: String(storeId),
          store_id: String(storeId),
          is_live_open: nextOpen,
          isLiveOpen: nextOpen
        };
        // Broadcast to ALL clients globally + store room + radar
        io.emit('store_status_changed', payload);
        io.to('radar').emit('store_status_changed', payload);
        io.to(`store:${storeId}`).emit('store_status_changed', payload);
        console.log(`[Socket.io] Broadcasted store_status_changed for store ${storeId}: ${nextOpen ? 'LIVE OPEN 🟢' : 'CLOSED 🔴'}`);
      } catch (err) {
        console.error('[Socket.io] toggle_store_status error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[Socket.io] Realtime engine initialized.');
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io has not been initialized yet');
  return io;
}

module.exports = {
  initSocket,
  getIO
};

