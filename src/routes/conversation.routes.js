const express = require('express');
const router = express.Router();
const { Conversation, Message, Store, User } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { getIO } = require('../socket');

// 1. List user's conversations
router.get('/', requireAuth, async (req, res) => {
  try {
    const { store_id } = req.query;
    const list = await Conversation.listByUser(req.user.id, req.user.role, store_id);

    // Hydrate store or customer names & users object for merchant UI
    const hydrated = await Promise.all(
      list.map(async (conv) => {
        const store = await Store.findById(conv.store_id);
        const customer = await User.findById(conv.customer_id);

        let lastMsg = conv.last_message || '';
        let lastMsgAt = conv.last_message_at || conv.created_at;
        if (!lastMsg) {
          const msgs = await Message.listByConversation(conv.id, { limit: 1 });
          if (msgs && msgs.length > 0) {
            lastMsg = msgs[msgs.length - 1].text || msgs[msgs.length - 1].content || '';
            lastMsgAt = msgs[msgs.length - 1].created_at || lastMsgAt;
          }
        }

        return {
          ...conv,
          last_message: lastMsg,
          last_message_at: lastMsgAt,
          store_name: store?.name || 'Local Store',
          store_logo: store?.logo_url || null,
          customer_name: customer?.full_name || 'Shopper Customer',
          customer_avatar: customer?.avatar_url || null,
          users: {
            id: customer?.id || conv.customer_id,
            full_name: customer?.full_name || 'Shopper Customer',
            avatar_url: customer?.avatar_url || null,
            phone_number: customer?.phone || ''
          }
        };
      })
    );

    return res.json({ success: true, count: hydrated.length, conversations: hydrated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Find or Create Conversation
router.post('/', requireAuth, async (req, res) => {
  try {
    const { store_id } = req.body;
    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const conv = await Conversation.findOrCreate({
      customer_id: req.user.id,
      store_id: String(store_id)
    });

    const store = await Store.findById(conv.store_id);
    return res.json({
      success: true,
      conversation: {
        ...conv,
        store_name: store?.name || 'Local Store',
        store_logo: store?.logo_url || null
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Conversation Message History
router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const messages = await Message.listByConversation(req.params.id);
    // Mark as read for this user
    await Conversation.markAsRead(req.params.id, req.user.role);
    return res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Send Message via REST API (also broadcasts to Socket.io)
router.post('/:id/messages', requireAuth, async (req, res) => {
  try {
    const { text, media_url, media_type } = req.body;
    if (!text && !media_url) {
      return res.status(400).json({ success: false, error: 'Text or media_url is required' });
    }

    const msg = await Message.create({
      conversation_id: req.params.id,
      sender_id: req.user.id,
      sender_role: req.user.role || 'customer',
      text: text || '',
      media_url: media_url || null,
      media_type: media_type || 'none'
    });

    await Conversation.updateLastMessage(req.params.id, {
      text: text || (media_type === 'image' ? '📷 Photo' : '🎥 Video'),
      senderRole: req.user.role
    });

    // Broadcast over Socket.io
    try {
      const io = getIO();
      io.to(`conversation:${req.params.id}`).emit('new_message', msg);
      const conv = await Conversation.findById(req.params.id);
      if (conv) {
        io.to(`store:${conv.store_id}`).emit('chat_notification', {
          conversation_id: req.params.id,
          message: msg
        });
        io.to(`user:${conv.customer_id}`).emit('chat_notification', {
          conversation_id: req.params.id,
          message: msg
        });
      }
    } catch (e) { }

    return res.status(201).json({ success: true, message: msg });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

