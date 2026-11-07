const { db } = require('../config/firebase');
const { executeDataConnect, toUUID } = require('../config/dataconnect');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'conversations';

class ConversationModel {
  static sanitize(data) {
    return {
      id: data.id || uuidv4(),
      customer_id: data.customer_id || data.customerId ? String(data.customer_id || data.customerId) : null,
      store_id: data.store_id || data.storeId ? String(data.store_id || data.storeId) : null,
      last_message: data.last_message || '',
      last_message_at: data.last_message_at || new Date().toISOString(),
      unread_count_customer: parseInt(data.unread_count_customer, 10) || 0,
      unread_count_store: parseInt(data.unread_count_store, 10) || 0,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  static async findById(id) {
    if (!id) return null;
    const formattedId = toUUID(id);

    // 1. Try Firebase Data Connect
    try {
      const q = `
        query FindConversationById($id: UUID!) {
          conversation(id: $id) {
            id
            storeId
            customerId
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { id: formattedId });
      if (res.data?.conversation) {
        const c = res.data.conversation;
        const cachedDoc = await db.collection(COLLECTION).doc(String(c.id)).get();
        const cached = cachedDoc.exists ? cachedDoc.data() : {};
        return {
          ...cached,
          id: c.id,
          store_id: c.storeId,
          customer_id: c.customerId,
          created_at: c.createdAt
        };
      }
    } catch (err) {
      console.warn('[Conversation] DataConnect findById error:', err.message);
    }

    // 2. Fallback to cache / Firestore
    const doc = await db.collection(COLLECTION).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  static async findOrCreate({ customer_id, store_id }) {
    if (!customer_id || !store_id) return null;

    const custUUID = toUUID(customer_id);
    const storeUUID = toUUID(store_id);

    // 1. Check Data Connect Cloud SQL first
    try {
      const q = `
        query FindConv($custId: UUID!, $stId: UUID!) {
          conversations(where: { customerId: { eq: $custId }, storeId: { eq: $stId } }, limit: 1) {
            id
            storeId
            customerId
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { custId: custUUID, stId: storeUUID });
      if (res.data?.conversations?.length) {
        const c = res.data.conversations[0];
        const cachedDoc = await db.collection(COLLECTION).doc(String(c.id)).get();
        const cached = cachedDoc.exists ? cachedDoc.data() : {};
        return {
          ...cached,
          id: c.id,
          customer_id: c.customerId,
          store_id: c.storeId,
          created_at: c.createdAt
        };
      }
    } catch (err) {
      console.warn('[Conversation] DataConnect find error:', err.message);
    }

    // 2. Check existing in cache / Firestore
    const snap = await db.collection(COLLECTION)
      .where('customer_id', '==', String(customer_id))
      .where('store_id', '==', String(store_id))
      .limit(1)
      .get();

    if (!snap.empty) {
      const existing = snap.docs[0].data();
      // Ensure it exists in Data Connect too
      try {
        await executeDataConnect(`
          mutation EnsureExisting($id: UUID!, $customerId: UUID!, $storeId: UUID!) {
            conversation_insert(data: {
              id: $id
              customerId: $customerId
              storeId: $storeId
            })
          }
        `, {
          id: toUUID(existing.id),
          customerId: custUUID,
          storeId: storeUUID
        });
      } catch (_) { }
      return existing;
    }

    // 3. Create new conversation
    const newConv = this.sanitize({ customer_id, store_id });
    await db.collection(COLLECTION).doc(String(newConv.id)).set(newConv);

    // Persist to Data Connect Cloud SQL
    try {
      const insertQ = `
        mutation CreateConv($id: UUID!, $customerId: UUID!, $storeId: UUID!) {
          conversation_insert(data: {
            id: $id
            customerId: $customerId
            storeId: $storeId
          })
        }
      `;
      const res = await executeDataConnect(insertQ, {
        id: toUUID(newConv.id),
        customerId: custUUID,
        storeId: storeUUID
      });
      if (res.data?.conversation_insert?.id) {
        console.log(`[Firebase DataConnect] Conversation created in Cloud SQL: ${res.data.conversation_insert.id}`);
        newConv.id = res.data.conversation_insert.id;
      } else if (res.errors) {
        console.warn('[Firebase DataConnect] Conversation insert errors:', JSON.stringify(res.errors));
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] Conversation insert exception:', err.message);
    }

    return newConv;
  }

  static async listByUser(userId, role = 'customer', storeId = null) {
    if (!userId) return [];

    let targetStoreId = storeId;
    if (role === 'dukandar') {
      if (!targetStoreId) {
        const StoreModel = require('./Store');
        const store = await StoreModel.findByOwnerId(userId);
        if (store) {
          targetStoreId = store.id;
        }
      }
    }

    // 1. Try Data Connect
    try {
      const isStore = role === 'dukandar';
      const targetId = isStore ? (targetStoreId || userId) : userId;
      const whereFilter = isStore ? `{ storeId: { eq: $id } }` : `{ customerId: { eq: $id } }`;
      const q = `
        query ListUserConversations($id: UUID!) {
          conversations(where: ${whereFilter}, orderBy: [{ createdAt: DESC }]) {
            id
            storeId
            customerId
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { id: toUUID(targetId) });
      if (Array.isArray(res.data?.conversations)) {
        const list = [];
        for (const c of res.data.conversations) {
          const cachedDoc = await db.collection(COLLECTION).doc(String(c.id)).get();
          const cached = cachedDoc.exists ? cachedDoc.data() : {};
          list.push({
            ...cached,
            id: c.id,
            store_id: c.storeId,
            customer_id: c.customerId,
            created_at: c.createdAt
          });
        }
        return list;
      }
    } catch (err) {
      console.warn('[Conversation] DataConnect listByUser fallback:', err.message);
    }

    // 2. Fallback to cache / Firestore
    const field = role === 'dukandar' ? 'store_id' : 'customer_id';
    const queryVal = role === 'dukandar' && targetStoreId ? targetStoreId : userId;
    const snap = await db.collection(COLLECTION)
      .where(field, '==', String(queryVal))
      .orderBy('last_message_at', 'desc')
      .get();
    return snap.docs.map(d => d.data());
  }

  static async updateLastMessage(id, { text, senderRole }) {
    const updates = {
      last_message: text,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (senderRole === 'customer') {
      updates.unread_count_store = (await this.findById(id))?.unread_count_store + 1 || 1;
    } else {
      updates.unread_count_customer = (await this.findById(id))?.unread_count_customer + 1 || 1;
    }
    await db.collection(COLLECTION).doc(String(id)).set(updates, { merge: true });
    return this.findById(id);
  }

  static async markAsRead(id, readerRole) {
    const updates = readerRole === 'customer'
      ? { unread_count_customer: 0 }
      : { unread_count_store: 0 };
    await db.collection(COLLECTION).doc(String(id)).set(updates, { merge: true });
    return true;
  }
}

module.exports = ConversationModel;
