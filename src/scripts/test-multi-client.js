process.env.NODE_ENV = 'test';
process.env.PORT = 5098;

const { server } = require('../server');

async function runMultiClientSuite() {
  console.log('================================================================');
  console.log('   DUKAN BARI - MULTI-CLIENT (WEB + CUSTOMER + SHOPKEEPER) SUITE ');
  console.log('================================================================\n');

  await new Promise((resolve) => server.listen(5098, resolve));
  const baseUrl = 'http://localhost:5098';

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

  async function req(endpoint, opts = {}) {
    const url = `${baseUrl}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // State across flows
  let webCustomerToken = null;
  let webCustomerId = null;
  let mobileCustomerToken = null;
  let mobileCustomerId = null;
  let dukandarToken = null;
  let dukandarStoreId = null;
  let testConversationId = null;
  let testEnquiryId = null;

  // -------------------------------------------------------------
  // CLIENT 1: WEB APPLICATION FLOWS
  // -------------------------------------------------------------
  console.log('--- 🌐 [CLIENT 1: WEB APPLICATION FLOWS] ---');

  await test('WEB: Register Customer Account', async () => {
    const res = await req('/api/auth/register', {
      method: 'POST',
      body: {
        email: `web.user.${Date.now()}@gmail.com`,
        full_name: 'Anjali Sharma',
        role: 'customer'
      }
    });
    if (res.status !== 201 || !res.data.token) throw new Error('Web registration failed');
    webCustomerToken = res.data.token;
    webCustomerId = res.data.user.id;
  });

  await test('WEB: Explore Page Queries Store Directory & Categories', async () => {
    const res = await req('/api/stores?category=Grocery');
    if (res.status !== 200 || !Array.isArray(res.data.stores)) throw new Error('Failed to query stores');
    if (res.data.stores.length > 0) {
      const s = res.data.stores[0];
      // Verify alias compatibility
      if (!s.name && !s.store_name) throw new Error('Missing store name/store_name');
    }
  });

  await test('WEB: Customer Posts Reverse Enquiry', async () => {
    const res = await req('/api/enquiries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${webCustomerToken}` },
      body: {
        category: 'Grocery',
        query: 'Need 10kg Aashirvaad Atta delivered to Sector 4',
        budget: 450,
        latitude: 28.6139,
        longitude: 77.2090
      }
    });
    if (res.status !== 201 || !res.data.enquiry) throw new Error('Enquiry post failed');
    testEnquiryId = res.data.enquiry.id;
  });

  // -------------------------------------------------------------
  // CLIENT 2: SHOPKEEPER MOBILE APP FLOWS
  // -------------------------------------------------------------
  console.log('\n--- 🏬 [CLIENT 2: SHOPKEEPER MOBILE APP FLOWS] ---');

  await test('SHOPKEEPER: Register Dukandar Account with Store', async () => {
    const res = await req('/api/auth/register', {
      method: 'POST',
      body: {
        email: `dukandar.${Date.now()}@dukanbari.com`,
        phone: '+919988776655',
        full_name: 'Rajesh Gupta',
        role: 'dukandar',
        store_name: 'Gupta Super Mart',
        category: 'Grocery',
        address: 'Shop 21, Market Complex, Delhi'
      }
    });
    if (res.status !== 201 || !res.data.token || !res.data.store) throw new Error('Shopkeeper registration failed');
    dukandarToken = res.data.token;
    dukandarStoreId = res.data.store.id;
  });

  await test('SHOPKEEPER: 1-Tap Toggle Live Counter Status', async () => {
    const res = await req(`/api/stores/${dukandarStoreId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${dukandarToken}` },
      body: { is_live_open: true }
    });
    if (res.status !== 200 || res.data.store.is_live_open !== true) throw new Error('Toggle live open failed');
  });

  await test('SHOPKEEPER: Add Product to Catalog', async () => {
    const res = await req('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${dukandarToken}` },
      body: {
        store_id: dukandarStoreId,
        name: 'Madhur Pure Sugar (1kg)',
        category: 'Grocery',
        price: 55,
        offer_price: 49,
        unit: 'packet',
        in_stock: true
      }
    });
    if (res.status !== 201 || !res.data.product) throw new Error('Product creation failed');
    if (res.data.product.discount_price !== 6) throw new Error('Discount price alias mismatch');
  });

  await test('SHOPKEEPER: View Nearby Customer Enquiries on Radar', async () => {
    const res = await req('/api/enquiries/nearby?lat=28.6139&lng=77.2090&radius=5', {
      headers: { Authorization: `Bearer ${dukandarToken}` }
    });
    if (res.status !== 200 || !Array.isArray(res.data.enquiries)) throw new Error('Nearby enquiries failed');
  });

  if (testEnquiryId) {
    await test('SHOPKEEPER: Submit Price Quote / Bid to Customer', async () => {
      const res = await req(`/api/enquiries/${testEnquiryId}/bid`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${dukandarToken}` },
        body: {
          store_id: dukandarStoreId,
          message: 'Fresh stock available. Instant pickup or delivery.',
          price: 440
        }
      });
      if (res.status !== 201 || !res.data.response) throw new Error('Bid submission failed');
    });
  }

  await test('SHOPKEEPER: Broadcast Flash Deal Offer', async () => {
    const res = await req('/api/offers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${dukandarToken}` },
      body: {
        store_id: dukandarStoreId,
        title: 'Morning Flash: 10% Off on Pulses',
        description: 'Valid till 12 PM today',
        discount_pct: 10
      }
    });
    if (res.status !== 201 || !res.data.offer) throw new Error('Offer creation failed');
  });

  // -------------------------------------------------------------
  // CLIENT 3: CUSTOMER MOBILE APP FLOWS
  // -------------------------------------------------------------
  console.log('\n--- 📱 [CLIENT 3: CUSTOMER MOBILE APP FLOWS] ---');

  await test('CUSTOMER APP: Register Mobile Customer', async () => {
    const res = await req('/api/auth/register', {
      method: 'POST',
      body: {
        phone: '+919123456789',
        full_name: 'Amit Patel',
        role: 'customer'
      }
    });
    if (res.status !== 201 || !res.data.token) throw new Error('Customer mobile registration failed');
    mobileCustomerToken = res.data.token;
    mobileCustomerId = res.data.user.id;
  });

  await test('CUSTOMER APP: Hyperlocal 1-5km Radar Query', async () => {
    const res = await req('/api/stores?lat=28.6139&lng=77.2090&radius=10');
    if (res.status !== 200 || !Array.isArray(res.data.stores)) throw new Error('Radar query failed');
    if (res.data.stores.length > 0) {
      const s = res.data.stores[0];
      if (s.distance_km === undefined) throw new Error('Missing distance_km calculation');
      if (!Array.isArray(s.products)) throw new Error('Missing hydrated products array');
    }
  });

  await test('CUSTOMER APP: Start Chat Conversation with Store', async () => {
    const res = await req('/api/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mobileCustomerToken}` },
      body: { store_id: dukandarStoreId }
    });
    if (res.status !== 200 || !res.data.conversation) throw new Error('Conversation creation failed');
    testConversationId = res.data.conversation.id;
  });

  if (testConversationId) {
    await test('CUSTOMER APP: Send Chat Message to Store', async () => {
      const res = await req(`/api/conversations/${testConversationId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${mobileCustomerToken}` },
        body: { text: 'Do you have brown eggs in stock?' }
      });
      if (res.status !== 201 || !res.data.message) throw new Error('Message send failed');
      if (res.data.message.content !== 'Do you have brown eggs in stock?') throw new Error('Content alias mismatch');
    });

    await test('CUSTOMER APP: Get Message History', async () => {
      const res = await req(`/api/conversations/${testConversationId}/messages`, {
        headers: { Authorization: `Bearer ${mobileCustomerToken}` }
      });
      if (res.status !== 200 || !Array.isArray(res.data.messages) || res.data.messages.length === 0) {
        throw new Error('Message history failed');
      }
    });
  }

  await test('CUSTOMER APP: Post Store Review & Rating', async () => {
    const res = await req('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mobileCustomerToken}` },
      body: {
        store_id: dukandarStoreId,
        rating: 5,
        comment: 'Great service and quick response!'
      }
    });
    if (res.status !== 201 || !res.data.review) throw new Error('Review failed');
  });

  // Verify store rating dynamically updated
  await test('STORE: Verified Average Rating Updated After Review', async () => {
    const res = await req(`/api/stores/${dukandarStoreId}`);
    if (res.status !== 200 || res.data.store.rating !== 5) {
      throw new Error(`Expected updated rating 5, got ${res.data.store?.rating}`);
    }
  });

  console.log('\n================================================================');
  console.log(`🎉 MULTI-CLIENT AUDIT COMPLETE: ${passed}/${total} TESTS PASSED!`);
  console.log('   Web, Customer Mobile App & Shopkeeper Mobile App contracts verified.');
  console.log('================================================================\n');

  server.close();

  if (passed !== total) {
    process.exit(1);
  }
}

runMultiClientSuite();

