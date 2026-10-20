"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChatHandlers = void 0;
const supabase_1 = require("../config/supabase");
const notification_service_1 = require("../services/notification.service");
const registerChatHandlers = (io, socket) => {
    const user = socket.data.user;
    // 1. Join Conversation Room
    socket.on('join_conversation', async ({ conversationId }) => {
        try {
            if (!conversationId)
                return;
            // Verify user is authorized to participate in this conversation
            const { data: conv, error } = await supabase_1.supabaseAdmin
                .from('conversations')
                .select('id, store_id, customer_id, stores(owner_id)')
                .eq('id', conversationId)
                .single();
            if (error || !conv) {
                socket.emit('error', { message: 'Conversation not found' });
                return;
            }
            const storeOwnerId = conv.stores?.owner_id;
            const isParticipant = conv.customer_id === user.id ||
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
                await supabase_1.supabaseAdmin
                    .from('conversations')
                    .update({ unread_count_customer: 0 })
                    .eq('id', conversationId);
            }
            else if (storeOwnerId === user.id) {
                await supabase_1.supabaseAdmin
                    .from('conversations')
                    .update({ unread_count_merchant: 0 })
                    .eq('id', conversationId);
            }
        }
        catch (err) {
            console.error('Error joining conversation room:', err);
        }
    });
    // 2. Leave Conversation Room
    socket.on('leave_conversation', ({ conversationId }) => {
        if (conversationId) {
            const room = `conversation:${conversationId}`;
            socket.leave(room);
            console.log(`[Socket] User ${user.full_name} left ${room}`);
        }
    });
    // 3. Send Message
    socket.on('send_message', async (payload) => {
        try {
            const { conversationId, messageType = 'text', content, mediaUrl, metadata = {} } = payload;
            if (!conversationId || (!content && !mediaUrl)) {
                socket.emit('error', { message: 'Invalid message payload' });
                return;
            }
            // Check conversation and resolve recipient
            const { data: conv, error: convErr } = await supabase_1.supabaseAdmin
                .from('conversations')
                .select('id, store_id, customer_id, stores(owner_id, store_name)')
                .eq('id', conversationId)
                .single();
            if (convErr || !conv) {
                socket.emit('error', { message: 'Conversation not found' });
                return;
            }
            const storeOwnerId = conv.stores?.owner_id;
            const recipientId = conv.customer_id === user.id ? storeOwnerId : conv.customer_id;
            // Insert message into Supabase
            const { data: newMessage, error: msgErr } = await supabase_1.supabaseAdmin
                .from('messages')
                .insert({
                conversation_id: conversationId,
                sender_id: user.id,
                message_type: messageType,
                content: content || (messageType === 'image' ? 'Photo' : 'Price Quote'),
                media_url: mediaUrl || null,
                metadata: metadata || {},
                is_read: false
            })
                .select()
                .single();
            if (msgErr || !newMessage) {
                socket.emit('error', { message: 'Failed to save message in database', error: msgErr?.message });
                return;
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
            const isRecipientInRoom = roomSockets.some((s) => s.data?.user?.id === recipientId);
            // If recipient is offline or not actively in this room, trigger push notification
            if (!isRecipientInRoom) {
                const preview = messageType === 'image'
                    ? '📷 Sent a photo'
                    : messageType === 'price_quote'
                        ? `💰 Sent a price quote: Rs. ${metadata?.quoted_price || ''}`
                        : content;
                await notification_service_1.NotificationService.notifyOfflineUser(recipientId, user.full_name, preview, conversationId);
            }
        }
        catch (err) {
            console.error('Error handling send_message:', err);
            socket.emit('error', { message: 'Internal error processing message' });
        }
    });
    // 4. Message Seen / Read Receipt
    socket.on('message_seen', async (payload) => {
        try {
            const { conversationId, messageId } = payload;
            if (!conversationId || !messageId)
                return;
            await supabase_1.supabaseAdmin
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
        }
        catch (err) {
            console.error('Error updating message_seen:', err);
        }
    });
    // 5. Typing Indicator
    socket.on('typing_indicator', ({ conversationId, isTyping }) => {
        if (!conversationId)
            return;
        const room = `conversation:${conversationId}`;
        socket.to(room).emit('user_typing', {
            conversationId,
            userId: user.id,
            userName: user.full_name,
            isTyping
        });
    });
};
exports.registerChatHandlers = registerChatHandlers;
