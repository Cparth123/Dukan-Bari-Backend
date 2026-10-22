import { Server } from 'socket.io';
import { AuthenticatedSocket } from './socketAuth';
import { supabaseAdmin } from '../config/supabase';
import { NotificationService } from '../services/notification.service';
import { MessageType, MessageMetadata } from '../types';

export interface SendMessagePayload {
  conversationId: string;
  messageType?: MessageType;
  content: string;
  mediaUrl?: string;
  metadata?: MessageMetadata;
}

export interface MessageSeenPayload {
  conversationId: string;
  messageId: string;
}

export interface TypingPayload {
  conversationId: string;
  isTyping: boolean;
}

export const registerChatHandlers = (io: Server, socket: AuthenticatedSocket) => {
  const user = socket.data.user;

  // 1. Join Conversation Room
  socket.on('join_conversation', async ({ conversationId }: { conversationId: string }) => {
    try {
      if (!conversationId) return;

      // Verify user is authorized to participate in this conversation
      const { data: conv, error } = await supabaseAdmin
        .from('conversations')
        .select('id, store_id, customer_id, stores(owner_id)')
        .eq('id', conversationId)
        .single();

      if (error || !conv) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const storeOwnerId = (conv.stores as any)?.owner_id;
      const isParticipant =
        conv.customer_id === user.id ||
        storeOwnerId === user.id ||
        user.role === 'superadmin';

      if (!isParticipant) {
        socket.emit('error', { message: 'Unauthorized to join this conversation' });
        return;
      }

      const room = `conversation:${conversationId}`;
      socket.join(room);
      console.log(`[Socket] User ${user.full_name} (${user.id}) joined ${room}`);

      // Reset unread count for the active viewer
      if (conv.customer_id === user.id) {
        await supabaseAdmin
          .from('conversations')
          .update({ unread_count_customer: 0 })
          .eq('id', conversationId);
      } else if (storeOwnerId === user.id) {
        await supabaseAdmin
          .from('conversations')
          .update({ unread_count_merchant: 0 })
          .eq('id', conversationId);
      }
    } catch (err) {
      console.error('Error joining conversation room:', err);
    }
  });

  // 2. Leave Conversation Room
  socket.on('leave_conversation', ({ conversationId }: { conversationId: string }) => {
    if (conversationId) {
      const room = `conversation:${conversationId}`;
      socket.leave(room);
      console.log(`[Socket] User ${user.full_name} left ${room}`);
    }
  });

  // 3. Send Message
  socket.on('send_message', async (payload: SendMessagePayload) => {
    try {
      const { conversationId, messageType = 'text', content, mediaUrl, metadata = {} } = payload;

      if (!conversationId || (!content && !mediaUrl)) {
        socket.emit('error', { message: 'Invalid message payload' });
        return;
      }

      // Check conversation and resolve recipient
      const { data: conv, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select('id, store_id, customer_id, stores(owner_id, store_name)')
        .eq('id', conversationId)
        .single();

      if (convErr || !conv) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const storeOwnerId = (conv.stores as any)?.owner_id;
      const recipientId = conv.customer_id === user.id ? storeOwnerId : conv.customer_id;

      // Check if message was already inserted by the HTTP API or if duplicate within 5s
      let newMessage: any = null;
      const passedMsgId = (payload as any).messageId || (payload as any).id;

      if (passedMsgId) {
        const { data: existingMsg } = await supabaseAdmin
          .from('messages')
          .select('*, users(full_name, role)')
          .eq('id', passedMsgId)
          .maybeSingle();
        if (existingMsg) {
          newMessage = existingMsg;
        }
      }

      if (!newMessage) {
        const targetContent = content || (messageType === 'image' ? 'Photo' : 'Price Quote');
        const { data: recentDup } = await supabaseAdmin
          .from('messages')
          .select('*, users(full_name, role)')
          .eq('conversation_id', conversationId)
          .eq('sender_id', user.id)
          .eq('content', targetContent)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const isRecentDuplicate =
          recentDup && (Date.now() - new Date(recentDup.created_at).getTime() < 5000);

        if (isRecentDuplicate) {
          newMessage = recentDup;
        } else {
          const { data: inserted, error: msgErr } = await supabaseAdmin
            .from('messages')
            .insert({
              conversation_id: conversationId,
              sender_id: user.id,
              message_type: messageType,
              content: targetContent,
              media_url: mediaUrl || null,
              metadata: metadata || {},
              is_read: false
            })
            .select('*, users(full_name, role)')
            .single();

          if (msgErr || !inserted) {
            socket.emit('error', { message: 'Failed to save message in database', error: msgErr?.message });
            return;
          }
          newMessage = inserted;
        }
      }

      const room = `conversation:${conversationId}`;

      // Emit to everyone in the room (including sender or acknowledge sender)
      io.to(room).emit('receive_message', {
        ...newMessage,
        sender_name: user.full_name,
        sender_role: user.role
      });

      // Check if recipient is currently inside the conversation room
      const roomSockets = await io.in(room).fetchSockets();
      const isRecipientInRoom = roomSockets.some(
        (s) => (s as unknown as AuthenticatedSocket).data?.user?.id === recipientId
      );

      // If recipient is offline or not actively in this room, trigger push notification
      if (!isRecipientInRoom) {
        const preview = messageType === 'image' 
          ? '📷 Sent a photo' 
          : messageType === 'price_quote' 
            ? `💰 Sent a price quote: Rs. ${metadata?.quoted_price || ''}` 
            : content;

        await NotificationService.notifyOfflineUser(
          recipientId,
          user.full_name,
          preview,
          conversationId
        );
      }
    } catch (err) {
      console.error('Error handling send_message:', err);
      socket.emit('error', { message: 'Internal error processing message' });
    }
  });

  // 4. Message Seen / Read Receipt
  socket.on('message_seen', async (payload: MessageSeenPayload) => {
    try {
      const { conversationId, messageId } = payload;
      if (!conversationId || !messageId) return;

      await supabaseAdmin
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);

      const room = `conversation:${conversationId}`;
      socket.to(room).emit('message_read_receipt', {
        conversationId,
        messageId,
        readByUserId: user.id,
        readAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error updating message_seen:', err);
    }
  });

  // 5. Typing Indicator
  socket.on('typing_indicator', ({ conversationId, isTyping }: TypingPayload) => {
    if (!conversationId) return;
    const room = `conversation:${conversationId}`;
    socket.to(room).emit('user_typing', {
      conversationId,
      userId: user.id,
      userName: user.full_name,
      isTyping
    });
  });
};
