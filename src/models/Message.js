const { db } = require('../config/firebase');
const { executeDataConnect, toUUID } = require('../config/dataconnect');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'messages';

class MessageModel {
  static sanitize(data) {
    const msgText = data.text || data.message || data.content || '';
    return {
      id: data.id || uuidv4(),
      conversation_id: String(data.conversation_id),
      sender_id: String(data.sender_id),
      sender_role: data.sender_role || 'customer', // 'customer' | 'dukandar'
      text: msgText,
      content: msgText,
      media_url: data.media_url || null, // Cloudinary image or video
      media_type: data.media_type || 'none', // 'none' | 'image' | 'video' | 'audio'
      is_read: Boolean(data.is_read),
      created_at: data.created_at || new Date().toISOString()
    };
  }

  static async findById(id) {
    if (!id) return null;
    const doc = await db.collection(COLLECTION).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  static async listByConversation(conversationId, { limit = 100 } = {}) {
    if (!conversationId) return [];

    // 1. Try Firebase Data Connect
    try {
      const q = `
        query ListMessagesByConv($convId: UUID!) {
          messages(where: { conversationId: { eq: $convId } }, limit: ${limit}, orderBy: [{ createdAt: ASC }]) {
            id
            conversationId
            senderId
            senderRole
            text
            mediaUrl
            mediaType
            isRead
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { convId: toUUID(conversationId) });
      if (res.data?.messages && res.data.messages.length > 0) {
        return res.data.messages.map(m => ({
          id: m.id,
          conversation_id: m.conversationId,
          sender_id: m.senderId,
          sender_role: m.senderRole,
          text: m.text,
          content: m.text,
          media_url: m.mediaUrl,
          media_type: m.mediaType,
          is_read: m.isRead,
          created_at: m.createdAt
        }));
      }
    } catch (err) {
      console.warn('[Message] Data Connect list fallback:', err.message);
    }

    // 2. Fallback to Firestore / in-memory cache
    const snap = await db.collection(COLLECTION)
      .where('conversation_id', '==', String(conversationId))
      .orderBy('created_at', 'asc')
      .limit(limit)
      .get();
    return snap.docs.map(d => d.data());
  }

  static async create(msgData) {
    const msg = this.sanitize(msgData);

    // Save locally & in Firestore / cache
    await db.collection(COLLECTION).doc(String(msg.id)).set(msg);

    // Persist to Firebase Data Connect Cloud SQL
    try {
      const convUUID = toUUID(msg.conversation_id);
      const senderUUID = toUUID(msg.sender_id);
      const msgUUID = toUUID(msg.id);

      // Step 1: Ensure conversation exists in Cloud SQL (to satisfy foreign key constraint)
      const checkConvQ = `
        query CheckConv($id: UUID!) {
          conversation(id: $id) {
            id
          }
        }
      `;
      const convCheckRes = await executeDataConnect(checkConvQ, { id: convUUID });

      if (!convCheckRes.data?.conversation) {
        // Conversation not yet committed to Cloud SQL; hydrate from cache and insert
        const ConversationModel = require('./Conversation');
        const convData = await ConversationModel.findById(msg.conversation_id);
        if (convData && convData.customer_id && convData.store_id) {
          const insertConvQ = `
            mutation EnsureConv($id: UUID!, $customerId: UUID!, $storeId: UUID!) {
              conversation_insert(data: {
                id: $id
                customerId: $customerId
                storeId: $storeId
              })
            }
          `;
          await executeDataConnect(insertConvQ, {
            id: convUUID,
            customerId: toUUID(convData.customer_id),
            storeId: toUUID(convData.store_id)
          });
        }
      }

      // Step 2: Insert Message into Cloud SQL
      const insertQ = `
        mutation CreateMsg($id: UUID!, $conversationId: UUID!, $senderId: UUID!, $senderRole: String!, $text: String!, $mediaUrl: String, $mediaType: String) {
          message_insert(data: {
            id: $id
            conversationId: $conversationId
            senderId: $senderId
            senderRole: $senderRole
            text: $text
            mediaUrl: $mediaUrl
            mediaType: $mediaType
          })
        }
      `;
      const res = await executeDataConnect(insertQ, {
        id: msgUUID,
        conversationId: convUUID,
        senderId: senderUUID,
        senderRole: msg.sender_role,
        text: msg.text,
        mediaUrl: msg.media_url,
        mediaType: msg.media_type
      });

      if (res.data?.message_insert?.id) {
        console.log(`[Firebase DataConnect] Message stored in Cloud SQL: ${res.data.message_insert.id}`);
        msg.id = res.data.message_insert.id;
      } else if (res.errors) {
        console.warn('[Firebase DataConnect] Message insert error:', JSON.stringify(res.errors));
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] Message insert exception:', err.message);
    }

    return msg;
  }

  static async markConversationRead(conversationId, readerId) {
    const snap = await db.collection(COLLECTION)
      .where('conversation_id', '==', String(conversationId))
      .where('is_read', '==', false)
      .get();

    const batch = db.batch ? db.batch() : null;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.sender_id !== readerId) {
        if (batch) {
          batch.update(doc.ref, { is_read: true });
        } else {
          await doc.ref.update({ is_read: true });
        }
      }
    }
    if (batch) await batch.commit();
    return true;
  }
}

module.exports = MessageModel;
