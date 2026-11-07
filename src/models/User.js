const { db } = require('../config/firebase');
const { executeDataConnect, toUUID } = require('../config/dataconnect');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'users';

class UserModel {
  static sanitize(data) {
    const fullName = data.full_name || data.name || data.fullName || '';
    const phoneNumber = data.phone || data.phone_number || null;
    return {
      id: data.id || uuidv4(),
      email: data.email ? String(data.email).toLowerCase().trim() : null,
      phone: phoneNumber ? String(phoneNumber).trim() : null,
      phone_number: phoneNumber ? String(phoneNumber).trim() : null,
      full_name: fullName,
      name: fullName,
      role: data.role || 'customer', // 'customer' | 'dukandar' | 'superadmin'
      address: data.address || '',
      latitude: data.latitude !== undefined && data.latitude !== null ? Number(data.latitude) : null,
      longitude: data.longitude !== undefined && data.longitude !== null ? Number(data.longitude) : null,
      avatar_url: data.avatar_url || data.avatarUrl || null,
      password_hash: data.password_hash || null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_at: data.created_at || data.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  static async findById(id) {
    if (!id) return null;
    const formattedId = toUUID(id);

    // 1. Try Firebase Data Connect (Cloud SQL PostgreSQL)
    try {
      const q = `
        query FindUserById($id: UUID!) {
          users(where: { id: { eq: $id } }, limit: 1) {
            id
            fullName
            email
            phone
            role
            avatarUrl
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { id: formattedId });
      if (Array.isArray(res.data?.users)) {
        if (res.data.users.length === 0) return null;
        const u = res.data.users[0];
        const cached = await db.collection(COLLECTION).doc(String(id)).get();
        const cachedData = cached.exists ? cached.data() : {};

        const userObj = {
          id: u.id,
          email: u.email,
          phone: u.phone,
          phone_number: u.phone,
          full_name: u.fullName,
          name: u.fullName,
          role: u.role,
          address: cachedData.address || '',
          latitude: cachedData.latitude !== undefined ? cachedData.latitude : null,
          longitude: cachedData.longitude !== undefined ? cachedData.longitude : null,
          avatar_url: u.avatarUrl,
          password_hash: cachedData.password_hash || null,
          created_at: u.createdAt
        };
        await db.collection(COLLECTION).doc(String(u.id)).set(userObj, { merge: true });
        return userObj;
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] findById notice:', err.message);
    }

    // 2. Fallback to local store / Firestore
    const doc = await db.collection(COLLECTION).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  static async findByEmail(email) {
    if (!email) return null;
    const cleanEmail = String(email).toLowerCase().trim();

    // 1. Try Firebase Data Connect
    try {
      const q = `
        query FindUserByEmail($email: String!) {
          users(where: { email: { eq: $email } }, limit: 1) {
            id
            fullName
            email
            phone
            role
            avatarUrl
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { email: cleanEmail });
      if (Array.isArray(res.data?.users)) {
        if (res.data.users.length === 0) return null;
        const u = res.data.users[0];
        const cached = await db.collection(COLLECTION).doc(String(u.id)).get();
        const cachedData = cached.exists ? cached.data() : {};

        const userObj = {
          id: u.id,
          email: u.email,
          phone: u.phone,
          phone_number: u.phone,
          full_name: u.fullName,
          name: u.fullName,
          role: u.role,
          address: cachedData.address || '',
          latitude: cachedData.latitude !== undefined ? cachedData.latitude : null,
          longitude: cachedData.longitude !== undefined ? cachedData.longitude : null,
          avatar_url: u.avatarUrl,
          password_hash: cachedData.password_hash || null,
          created_at: u.createdAt
        };
        await db.collection(COLLECTION).doc(String(u.id)).set(userObj, { merge: true });
        return userObj;
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] findByEmail notice:', err.message);
    }

    // 2. Fallback to local store / Firestore
    const snap = await db.collection(COLLECTION)
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();
    return !snap.empty ? snap.docs[0].data() : null;
  }

  static async findByPhone(phone) {
    if (!phone) return null;
    const cleanPhone = String(phone).trim();

    // 1. Try Firebase Data Connect
    try {
      const q = `
        query FindUserByPhone($phone: String!) {
          users(where: { phone: { eq: $phone } }, limit: 1) {
            id
            fullName
            email
            phone
            role
            avatarUrl
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { phone: cleanPhone });
      if (Array.isArray(res.data?.users)) {
        if (res.data.users.length === 0) return null;
        const u = res.data.users[0];
        const cached = await db.collection(COLLECTION).doc(String(u.id)).get();
        const cachedData = cached.exists ? cached.data() : {};

        const userObj = {
          id: u.id,
          email: u.email,
          phone: u.phone,
          phone_number: u.phone,
          full_name: u.fullName,
          name: u.fullName,
          role: u.role,
          address: cachedData.address || '',
          latitude: cachedData.latitude !== undefined ? cachedData.latitude : null,
          longitude: cachedData.longitude !== undefined ? cachedData.longitude : null,
          avatar_url: u.avatarUrl,
          password_hash: cachedData.password_hash || null,
          created_at: u.createdAt
        };
        await db.collection(COLLECTION).doc(String(u.id)).set(userObj, { merge: true });
        return userObj;
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] findByPhone notice:', err.message);
    }

    // 2. Fallback to local store / Firestore
    const snap = await db.collection(COLLECTION)
      .where('phone', '==', cleanPhone)
      .limit(1)
      .get();
    return !snap.empty ? snap.docs[0].data() : null;
  }

  static async create(userData) {
    const user = this.sanitize(userData);

    // 1. Commit to Firebase Data Connect (Cloud SQL PostgreSQL)
    try {
      const mutation = `
        mutation CreateUser($fullName: String!, $email: String, $phone: String, $role: String!, $avatarUrl: String) {
          user_insert(data: {
            fullName: $fullName
            email: $email
            phone: $phone
            role: $role
            avatarUrl: $avatarUrl
          })
        }
      `;
      const res = await executeDataConnect(mutation, {
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatar_url
      });
      if (res.data?.user_insert?.id) {
        user.id = res.data.user_insert.id;
        console.log('[Firebase DataConnect] Successfully inserted User in Cloud SQL:', user.id, user.email);
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] create user error:', err.message);
    }

    // 2. Save locally / Firestore cache
    await db.collection(COLLECTION).doc(String(user.id)).set(user);
    return user;
  }

  static async update(id, updates) {
    const formattedId = toUUID(id);
    const cleanUpdates = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    delete cleanUpdates.id;

    // 1. Update in Firebase Data Connect
    try {
      const dataPayload = {};
      if (updates.full_name || updates.name || updates.fullName) {
        dataPayload.fullName = updates.full_name || updates.name || updates.fullName;
      }
      if (updates.email) dataPayload.email = updates.email;
      if (updates.phone || updates.phone_number) dataPayload.phone = updates.phone || updates.phone_number;
      if (updates.role) dataPayload.role = updates.role;
      if (updates.avatar_url || updates.avatarUrl) dataPayload.avatarUrl = updates.avatar_url || updates.avatarUrl;

      if (Object.keys(dataPayload).length > 0) {
        const mutation = `
          mutation UpdateUser($id: UUID!, $data: User_Data!) {
            user_update(id: $id, data: $data)
          }
        `;
        await executeDataConnect(mutation, { id: formattedId, data: dataPayload });
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] update user error:', err.message);
    }

    // 2. Update local / Firestore
    await db.collection(COLLECTION).doc(String(id)).set(cleanUpdates, { merge: true });
    return this.findById(id);
  }

  static async list({ role, limit = 50 } = {}) {
    // 1. Try Firebase Data Connect
    try {
      const q = `
        query ListUsers {
          users(limit: ${limit}) {
            id
            fullName
            email
            phone
            role
            avatarUrl
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q);
      if (res.data?.users) {
        let users = res.data.users.map(u => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          full_name: u.fullName,
          role: u.role,
          avatar_url: u.avatarUrl,
          created_at: u.createdAt
        }));
        if (role) users = users.filter(u => u.role === role);
        return users;
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] list users notice:', err.message);
    }

    let query = db.collection(COLLECTION);
    if (role) query = query.where('role', '==', role);
    const snap = await query.limit(limit).get();
    return snap.docs.map(d => d.data());
  }

  static async delete(id) {
    const formattedId = toUUID(id);
    try {
      const mutation = `
        mutation DeleteUser($id: UUID!) {
          user_delete(id: $id)
        }
      `;
      await executeDataConnect(mutation, { id: formattedId });
    } catch (err) {
      console.warn('[Firebase DataConnect] delete user error:', err.message);
    }
    await db.collection(COLLECTION).doc(String(id)).delete();
    return true;
  }
}

module.exports = UserModel;
