const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let db = null;
let isMock = false;

// 1. Load serviceAccountKey.json if present
const serviceAccountPaths = [
  path.join(__dirname, '../../serviceAccountKey.json'),
  path.join(__dirname, '../serviceAccountKey.json'),
  path.join(__dirname, 'serviceAccountKey.json'),
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH
].filter(Boolean);

let serviceAccount = null;

// Try loading from environment variable JSON or base64 string
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    const jsonStr = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    serviceAccount = JSON.parse(jsonStr);
    console.log(`[Firebase] Loaded service account from FIREBASE_SERVICE_ACCOUNT_KEY env var (Project: ${serviceAccount.project_id || serviceAccount.projectId})`);
  } catch (e) {
    console.warn('[Firebase] Could not parse FIREBASE_SERVICE_ACCOUNT_KEY env var:', e.message);
  }
}

if (!serviceAccount) {
  for (const p of serviceAccountPaths) {
    if (fs.existsSync(p)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
        console.log(`[Firebase] Loaded service account from ${p} (Project: ${serviceAccount.project_id || serviceAccount.projectId})`);
        break;
      } catch (e) {
        console.warn(`[Firebase] Could not parse ${p}:`, e.message);
      }
    }
  }
}

// 2. Or initialize from separate individual environment variables
if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  };
  console.log('[Firebase] Loaded service account from individual environment variables');
}

// In-Memory Database Implementation for Zero-Crash Offline / Pre-Provisioned Mode
const memoryStore = new Map();

function clearAllCache() {
  const count = memoryStore.size;
  memoryStore.clear();
  console.log(`[Firebase Cache] Purged in-memory cache across all ${count} collections.`);
  return { purgedCollections: count };
}

class MockDocRef {
  constructor(collectionName, id) {
    this.collectionName = collectionName;
    this.id = id;
  }

  async get() {
    const col = memoryStore.get(this.collectionName) || new Map();
    const data = col.get(this.id);
    return {
      id: this.id,
      exists: !!data,
      data: () => (data ? { ...data } : undefined)
    };
  }

  async set(data, options = {}) {
    if (!memoryStore.has(this.collectionName)) {
      memoryStore.set(this.collectionName, new Map());
    }
    const col = memoryStore.get(this.collectionName);
    const existing = col.get(this.id) || {};
    const merged = options.merge ? { ...existing, ...data } : { ...data };
    merged.id = this.id;
    col.set(this.id, merged);
    return { writeTime: new Date() };
  }

  async update(data) {
    const col = memoryStore.get(this.collectionName);
    if (!col || !col.has(this.id)) {
      throw new Error(`Document ${this.id} not found in ${this.collectionName}`);
    }
    const existing = col.get(this.id);
    const updated = { ...existing, ...data, id: this.id };
    col.set(this.id, updated);
    return { writeTime: new Date() };
  }

  async delete() {
    const col = memoryStore.get(this.collectionName);
    if (col) col.delete(this.id);
    return { writeTime: new Date() };
  }
}

class MockQuery {
  constructor(collectionName, filters = [], sortField = null, sortDir = 'asc', limitCount = null) {
    this.collectionName = collectionName;
    this.filters = filters;
    this.sortField = sortField;
    this.sortDir = sortDir;
    this.limitCount = limitCount;
  }

  where(field, op, value) {
    return new MockQuery(
      this.collectionName,
      [...this.filters, { field, op, value }],
      this.sortField,
      this.sortDir,
      this.limitCount
    );
  }

  orderBy(field, direction = 'asc') {
    return new MockQuery(this.collectionName, this.filters, field, direction, this.limitCount);
  }

  limit(n) {
    return new MockQuery(this.collectionName, this.filters, this.sortField, this.sortDir, n);
  }

  async get() {
    const col = memoryStore.get(this.collectionName) || new Map();
    let docs = Array.from(col.values());

    for (const f of this.filters) {
      docs = docs.filter(item => {
        const val = item[f.field];
        if (f.op === '==' || f.op === '===') return val === f.value;
        if (f.op === '!=') return val !== f.value;
        if (f.op === '>') return val > f.value;
        if (f.op === '>=') return val >= f.value;
        if (f.op === '<') return val < f.value;
        if (f.op === '<=') return val <= f.value;
        if (f.op === 'array-contains') return Array.isArray(val) && val.includes(f.value);
        if (f.op === 'in') return Array.isArray(f.value) && f.value.includes(val);
        return true;
      });
    }

    if (this.sortField) {
      docs.sort((a, b) => {
        if (a[this.sortField] < b[this.sortField]) return this.sortDir === 'desc' ? 1 : -1;
        if (a[this.sortField] > b[this.sortField]) return this.sortDir === 'desc' ? -1 : 1;
        return 0;
      });
    }

    if (this.limitCount && this.limitCount > 0) {
      docs = docs.slice(0, this.limitCount);
    }

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs: docs.map(d => ({
        id: d.id,
        data: () => ({ ...d }),
        exists: true
      }))
    };
  }
}

class MockCollectionRef extends MockQuery {
  constructor(collectionName) {
    super(collectionName);
  }

  doc(id) {
    const docId = id || Math.random().toString(36).substring(2, 15);
    return new MockDocRef(this.collectionName, docId);
  }

  async add(data) {
    const id = data.id || Math.random().toString(36).substring(2, 15);
    const docRef = this.doc(id);
    await docRef.set({ ...data, id });
    return docRef;
  }
}

const mockDb = {
  collection: (name) => new MockCollectionRef(name),
  _memoryStore: memoryStore
};

let liveDb = null;
if (serviceAccount) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    liveDb = admin.firestore();
    console.log('[Firebase] Cloud Firestore client configured.');
  } catch (err) {
    console.warn('[Firebase] Initialization error:', err.message);
  }
}

// Proxy wrapper that routes to live Firestore, or falls back to in-memory store if Firestore database instance is not provisioned
const proxyDb = {
  collection: (name) => {
    if (!liveDb || isMock) return mockDb.collection(name);

    const realCol = liveDb.collection(name);
    return {
      doc: (id) => {
        const realDoc = realCol.doc(id);
        return {
          get: async () => {
            try {
              return await realDoc.get();
            } catch (err) {
              if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
                isMock = true;
                console.warn('[Firebase] Firestore database (default) not provisioned in Firebase console. Auto-switched to Local Memory Mode.');
                return mockDb.collection(name).doc(id).get();
              }
              throw err;
            }
          },
          set: async (data, opt) => {
            try {
              return await realDoc.set(data, opt);
            } catch (err) {
              if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
                isMock = true;
                console.warn('[Firebase] Firestore database (default) not provisioned in Firebase console. Auto-switched to Local Memory Mode.');
                return mockDb.collection(name).doc(id).set(data, opt);
              }
              throw err;
            }
          },
          update: async (data) => {
            try {
              return await realDoc.update(data);
            } catch (err) {
              if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
                isMock = true;
                return mockDb.collection(name).doc(id).update(data);
              }
              throw err;
            }
          },
          delete: async () => {
            try {
              return await realDoc.delete();
            } catch (err) {
              if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
                isMock = true;
                return mockDb.collection(name).doc(id).delete();
              }
              throw err;
            }
          }
        };
      },
      where: (field, op, val) => {
        return {
          get: async () => {
            try {
              return await realCol.where(field, op, val).get();
            } catch (err) {
              if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
                isMock = true;
                return mockDb.collection(name).where(field, op, val).get();
              }
              throw err;
            }
          },
          where: (f2, op2, val2) => mockDb.collection(name).where(field, op, val).where(f2, op2, val2),
          orderBy: (f, d) => mockDb.collection(name).where(field, op, val).orderBy(f, d),
          limit: (n) => mockDb.collection(name).where(field, op, val).limit(n)
        };
      },
      orderBy: (field, dir) => {
        if (!liveDb || isMock) return mockDb.collection(name).orderBy(field, dir);
        return {
          limit: (n) => mockDb.collection(name).orderBy(field, dir).limit(n),
          get: async () => {
            try {
              return await realCol.orderBy(field, dir).get();
            } catch (err) {
              if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
                isMock = true;
                return mockDb.collection(name).orderBy(field, dir).get();
              }
              throw err;
            }
          }
        };
      },
      limit: (n) => {
        if (!liveDb || isMock) return mockDb.collection(name).limit(n);
        return {
          get: async () => {
            try {
              return await realCol.limit(n).get();
            } catch (err) {
              if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
                isMock = true;
                return mockDb.collection(name).limit(n).get();
              }
              throw err;
            }
          }
        };
      },
      get: async () => {
        try {
          return await realCol.get();
        } catch (err) {
          if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
            isMock = true;
            return mockDb.collection(name).get();
          }
          throw err;
        }
      }
    };
  }
};

const clientConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAGtQOO79Xi_ZsW3zjSQCtcfNtY_rao9y4",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "dukan-bari.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "dukan-bari",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "dukan-bari.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "740104440982",
  appId: process.env.FIREBASE_APP_ID || "1:740104440982:web:a3b6d4649d8d324da306b7"
};

module.exports = {
  admin,
  db: proxyDb,
  clientConfig,
  get isMock() { return isMock; },
  clearAllCache,
  getServiceAccount: () => serviceAccount
};
