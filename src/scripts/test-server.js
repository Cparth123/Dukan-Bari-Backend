process.env.NODE_ENV = 'test';
process.env.PORT = 5099;

const http = require('http');
const { server } = require('../server');
const { io: ClientIO } = require('socket.io-client');

async function testFullBackend() {
  console.log('========================================================');
  console.log('    DUKAN BARI - FULL SERVER & API VERIFICATION SUITE   ');
  console.log('========================================================\n');

  // Start server on test port
  await new Promise((resolve) => server.listen(5099, resolve));
  const baseUrl = 'http://localhost:5099';

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  async function request(endpoint, options = {}) {
    const url = `${baseUrl}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const json = await res.json();
    return { status: res.status, data: json };
  }

  let authToken = null;
  let testUserId = null;
  let testStoreId = null;

  // 1. Health check
  await test('GET /health returns online status', async () => {
    const res = await request('/health');
    if (res.status !== 200 || res.data.status !== 'online') {
      throw new Error(`Expected status online, got ${JSON.stringify(res.data)}`);
    }
  });

  // 2. Auth: Register Dukandar
  await test('POST /api/auth/register creates dukandar with store', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: {
        email: `test.dukandar.${Date.now()}@dukanbari.com`,
        password: 'password123',
        full_name: 'Test Dukandar',
        role: 'dukandar',
        store_name: 'Test Super Store',
        category: 'Grocery'
      }
    });
    if (res.status !== 201 || !res.data.token) {
      throw new Error(`Registration failed: ${JSON.stringify(res.data)}`);
    }
    authToken = res.data.token;
    testUserId = res.data.user.id;
    testStoreId = res.data.store?.id;
  });

  // 3. Auth: GET /api/auth/me
  await test('GET /api/auth/me verifies JWT Bearer token', async () => {
    const res = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200 || res.data.user.id !== testUserId) {
      throw new Error(`Auth me failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 4. Store: GET /api/stores
  await test('GET /api/stores returns store list', async () => {
    const res = await request('/api/stores');
    if (res.status !== 200 || !Array.isArray(res.data.stores)) {
      throw new Error('Expected array of stores');
    }
  });

  // 5. Store: PATCH /api/stores/:id/status
  if (testStoreId) {
    await test('PATCH /api/stores/:id/status toggles live open status', async () => {
      const res = await request(`/api/stores/${testStoreId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { is_live_open: true }
      });
      if (res.status !== 200 || res.data.store.is_live_open !== true) {
        throw new Error('Toggle live open failed');
      }
    });
  }

  // 6. Products: POST /api/products
  if (testStoreId) {
    await test('POST /api/products adds product to store', async () => {
      const res = await request('/api/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          store_id: testStoreId,
          name: 'Amul Butter 500g',
          category: 'Dairy',
          price: 275,
          unit: 'packet'
        }
      });
      if (res.status !== 201 || !res.data.product) {
        throw new Error(`Product creation failed: ${JSON.stringify(res.data)}`);
      }
    });
  }

  // 7. Offers: GET /api/offers
  await test('GET /api/offers returns offers list', async () => {
    const res = await request('/api/offers');
    if (res.status !== 200 || !Array.isArray(res.data.offers)) {
      throw new Error('Expected array of offers');
    }
  });

  // 8. Reverse Enquiry: POST /api/enquiries
  await test('POST /api/enquiries posts customer enquiry', async () => {
    const res = await request('/api/enquiries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        category: 'Grocery',
        query: 'Need 5kg Basmati Rice',
        budget: 500
      }
    });
    if (res.status !== 201 || !res.data.enquiry) {
      throw new Error('Enquiry failed');
    }
  });

  // 9. Socket.io Real-time connection & message exchange
  await test('Socket.io connects and sends real-time message', async () => {
    await new Promise((resolve, reject) => {
      const socket = ClientIO('http://localhost:5099', {
        auth: { token: authToken }
      });

      socket.on('connect', () => {
        socket.emit('join_conversation', 'test_conv_room');
        socket.emit('send_message', {
          conversation_id: 'test_conv_room',
          text: 'Hello from verification test!',
          sender_id: testUserId,
          sender_role: 'dukandar'
        }, (ack) => {
          socket.disconnect();
          if (ack && ack.success) {
            resolve();
          } else {
            reject(new Error(ack?.error || 'Socket send_message failed'));
          }
        });
      });

      socket.on('connect_error', (err) => {
        socket.disconnect();
        reject(err);
      });
    });
  });

  console.log('\n--------------------------------------------------------');
  console.log(`Results: ${passed}/${total} server tests passed!`);
  console.log('--------------------------------------------------------\n');

  server.close();

  if (passed !== total) {
    process.exit(1);
  }
}

testFullBackend();

