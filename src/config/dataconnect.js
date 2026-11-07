const path = require('path');
const fs = require('fs');

let admin = null;
try {
  admin = require('firebase-admin');
} catch {
  admin = require(path.join(__dirname, '../../node_modules/firebase-admin'));
}

const { getServiceAccount } = require('./firebase');

const serviceAccountPaths = [
  path.join(__dirname, '../../serviceAccountKey.json'),
  path.join(__dirname, '../serviceAccountKey.json'),
  path.join(__dirname, 'serviceAccountKey.json'),
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH
].filter(Boolean);

let serviceAccount = getServiceAccount ? getServiceAccount() : null;

if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    const jsonStr = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    serviceAccount = JSON.parse(jsonStr);
  } catch (e) {
    console.warn('[DataConnect] Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
  }
}

if (!serviceAccount) {
  for (const p of serviceAccountPaths) {
    if (fs.existsSync(p)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      } catch (e) {
        console.warn(`[DataConnect] Could not read ${p}:`, e.message);
      }
    }
  }
}

if (serviceAccount && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    // Already initialized or warning
  }
}

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  if (!serviceAccount) return null;

  try {
    const tokenObj = await admin.credential.cert(serviceAccount).getAccessToken();
    cachedToken = tokenObj.access_token;
    // Cache for 50 minutes (tokens valid for 60 min)
    tokenExpiry = now + 50 * 60 * 1000;
    return cachedToken;
  } catch (err) {
    console.error('[DataConnect] Error getting access token:', err.message);
    return null;
  }
}

const ENDPOINT = 'https://firebasedataconnect.googleapis.com/v1beta/projects/dukan-bari/locations/asia-east1/services/dukan-bari-service:executeGraphql';

const crypto = require('crypto');

function toUUID(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s)) {
    return s.toLowerCase();
  }
  const clean = s.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length === 32) {
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`.toLowerCase();
  }
  const hash = crypto.createHash('md5').update(s).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`.toLowerCase();
}

async function executeDataConnect(query, variables = {}) {
  try {
    const token = await getAccessToken();
    if (!token) return { data: null, errors: [{ message: 'No access token' }] };

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ query, variables })
    });

    const json = await res.json();
    return json;
  } catch (err) {
    console.error('[DataConnect] HTTP execution error:', err.message);
    return { data: null, errors: [{ message: err.message }] };
  }
}

module.exports = {
  executeDataConnect,
  toUUID,
  getAccessToken
};

