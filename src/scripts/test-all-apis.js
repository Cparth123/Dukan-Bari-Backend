/**
 * Comprehensive Automated End-to-End Test Suite for All Dukan Bari API Endpoints
 * Tests: Auth, Stores, Products, Conversations, Messages, Enquiries, Offers, Reviews, Role Mismatch
 */

const BASE_URLS = [
  'http://localhost:5000/api',
  'https://dukan-bari-backend.onrender.com/api'
];

async function runTestSuite(baseUrl) {
  console.log('\n============================================================');
  console.log(`🚀 RUNNING FULL ENDPOINT AUDIT AGAINST: ${baseUrl}`);
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;
  const results = [];

  function record(name, isSuccess, details = '') {
    if (isSuccess) {
      passed++;
      console.log(`  ✅ [PASS] ${name} ${details ? `(${details})` : ''}`);
      results.push({ name, status: 'PASS', details });
    } else {
      failed++;
      console.log(`  ❌ [FAIL] ${name} ${details ? `(${details})` : ''}`);
      results.push({ name, status: 'FAIL', details });
    }
  }

  async function api(endpoint, method = 'GET', body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${baseUrl}${endpoint}`, opts);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = { rawText: await res.text().catch(() => '') };
    }
    return { status: res.status, ok: res.ok, data };
  }

  const timestamp = Date.now();
  const customerEmail = `audit_cust_${timestamp}@test.com`;
  const customerPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const dukandarEmail = `audit_store_${timestamp}@test.com`;
  const dukandarPhone = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
  const password = 'Password@123';

  let customerToken = null;
  let customerUser = null;
  let dukandarToken = null;
  let dukandarStore = null;
  let conversationId = null;
  let enquiryId = null;
  let productId = null;

  try {
    // 1. GET /stores (Public Store Listing)
    const res1 = await api('/stores');
    record('GET /stores', res1.ok && Array.isArray(res1.data.stores), `Found ${res1.data.count ?? res1.data.stores?.length ?? 0} stores`);

    // 2. GET /stores with GPS radar query
    const res2 = await api('/stores?lat=21.1702&lng=72.8311&radius=5');
    record('GET /stores (GPS Radar Filter)', res2.ok && Array.isArray(res2.data.stores), `Status ${res2.status}`);

    // 3. POST /auth/register (Customer Registration)
    const res3 = await api('/auth/register', 'POST', {
      email: customerEmail,
      phone: customerPhone,
      password,
      full_name: 'Audit Customer',
      role: 'customer'
    });
    customerToken = res3.data.token;
    customerUser = res3.data.user;
    record('POST /auth/register (Customer)', res3.ok && !!customerToken, `User ID: ${customerUser?.id}`);

    // 4. POST /auth/login (Customer Login)
    const res4 = await api('/auth/login', 'POST', {
      email: customerEmail,
      password
    });
    record('POST /auth/login (Customer Email)', res4.ok && !!res4.data.token, `Token verified`);

    // 5. POST /auth/login with Phone (Customer Login)
    const res5 = await api('/auth/login', 'POST', {
      phone: customerPhone,
      password
    });
    record('POST /auth/login (Customer Phone)', res5.ok && !!res5.data.token, `Phone login verified`);

    // 6. GET /auth/me (Customer Auth Verification)
    const res6 = await api('/auth/me', 'GET', null, customerToken);
    record('GET /auth/me (Customer Token)', res6.ok && res6.data.user?.role === 'customer', `Role: ${res6.data.user?.role}`);

    // 7. PUT /auth/profile (Customer Profile Update)
    const res7 = await api('/auth/profile', 'PUT', {
      full_name: 'Audit Customer Updated',
      address: 'Flat 402, Green Avenue, Surat',
      latitude: 21.1750,
      longitude: 72.8350
    }, customerToken);
    record('PUT /auth/profile (Customer Settings)', res7.ok, `Updated name: ${res7.data.user?.full_name}`);

    // 8. POST /auth/register (Dukandar / Shopkeeper Registration)
    const res8 = await api('/auth/register', 'POST', {
      email: dukandarEmail,
      phone: dukandarPhone,
      password,
      full_name: 'Audit Dukandar',
      store_name: `Audit Store ${timestamp}`,
      category: 'Grocery & Kirana',
      address: 'Shop 10, Market Road, Surat',
      role: 'dukandar'
    });
    dukandarToken = res8.data.token;
    dukandarStore = res8.data.store;
    record('POST /auth/register (Dukandar & Storefront)', res8.ok && !!dukandarToken && !!dukandarStore?.id, `Store ID: ${dukandarStore?.id}`);

    // 9. POST /auth/login (Dukandar Login)
    const res9 = await api('/auth/login', 'POST', {
      email: dukandarEmail,
      password
    });
    record('POST /auth/login (Dukandar)', res9.ok && !!res9.data.token && !!res9.data.store, `Store: ${res9.data.store?.name}`);

    // 10. GET /auth/me (Dukandar Auth Verification)
    const res10 = await api('/auth/me', 'GET', null, dukandarToken);
    record('GET /auth/me (Dukandar Token)', res10.ok && res10.data.user?.role === 'dukandar', `Role: ${res10.data.user?.role}`);

    // 11. PUT /auth/profile (Dukandar Store Profile Update)
    const res11 = await api('/auth/profile', 'PUT', {
      store_name: `Audit Store Updated ${timestamp}`,
      category: 'Dairy, Milk & Bakery',
      address: 'C4 Katargam, Surat',
      phone: dukandarPhone,
      latitude: 21.1702,
      longitude: 72.8311
    }, dukandarToken);
    record('PUT /auth/profile (Store Dashboard Sync)', res11.ok, `Store: ${res11.data.store?.name}`);

    // 12. GET /stores/:id (Single Store Details with Products & Reviews)
    if (dukandarStore?.id) {
      const res12 = await api(`/stores/${dukandarStore.id}`);
      record('GET /stores/:id (Store Details)', res12.ok && !!res12.data.store, `Found ${res12.data.store?.name}`);
    }

    // 13. PATCH /stores/:id/status (Toggle Live Open Status)
    if (dukandarStore?.id) {
      const res13 = await api(`/stores/${dukandarStore.id}/status`, 'PATCH', { is_live_open: false }, dukandarToken);
      record('PATCH /stores/:id/status (Toggle Closed)', res13.ok && res13.data.is_live_open === false, `is_live_open: ${res13.data.is_live_open}`);

      const res13b = await api(`/stores/${dukandarStore.id}/status`, 'PATCH', { is_live_open: true }, dukandarToken);
      record('PATCH /stores/:id/status (Toggle Live Open)', res13b.ok && res13b.data.is_live_open === true, `is_live_open: ${res13b.data.is_live_open}`);
    }

    // 14. POST /products (Dukandar Adds Product)
    if (dukandarStore?.id) {
      const res14 = await api('/products', 'POST', {
        store_id: dukandarStore.id,
        name: 'Amul Taaza Milk 500ml',
        description: 'Fresh toned milk',
        price: 27,
        offer_price: 26,
        category: 'Dairy',
        unit: '500 ml',
        in_stock: true
      }, dukandarToken);
      productId = res14.data.product?.id;
      record('POST /products (Add Store Product)', res14.ok && !!productId, `Product ID: ${productId}`);
    }

    // 15. GET /products/store/:storeId (List Products for Store)
    if (dukandarStore?.id) {
      const res15 = await api(`/products/store/${dukandarStore.id}`);
      record('GET /products/store/:id (Store Products)', res15.ok && Array.isArray(res15.data.products), `Count: ${res15.data.count}`);
    }

    // 16. GET /products/search?q=Amul (Product Search)
    const res16 = await api('/products/search?q=Amul');
    record('GET /products/search?q=...', res16.ok && Array.isArray(res16.data.products), `Results: ${res16.data.count}`);

    // 17. POST /conversations (Customer Initiates Chat with Store)
    if (dukandarStore?.id) {
      const res17 = await api('/conversations', 'POST', {
        store_id: dukandarStore.id
      }, customerToken);
      conversationId = res17.data.conversation?.id;
      record('POST /conversations (Start Chat)', res17.ok && !!conversationId, `Conversation ID: ${conversationId}`);
    }

    // 18. GET /conversations (List Conversations)
    const res18 = await api('/conversations', 'GET', null, customerToken);
    record('GET /conversations (Customer Chats)', res18.ok && Array.isArray(res18.data.conversations), `Found ${res18.data.count}`);

    // 19. POST /conversations/:id/messages (Customer Sends Message)
    if (conversationId) {
      const res19 = await api(`/conversations/${conversationId}/messages`, 'POST', {
        text: 'Hi, is Amul Taaza milk in stock right now?'
      }, customerToken);
      record('POST /conversations/:id/messages (Customer Msg)', res19.ok && !!res19.data.message?.id, `Msg ID: ${res19.data.message?.id}`);
    }

    // 20. GET /conversations/:id/messages (Fetch Messages)
    if (conversationId) {
      const res20 = await api(`/conversations/${conversationId}/messages`, 'GET', null, customerToken);
      record('GET /conversations/:id/messages (Fetch Chat)', res20.ok && Array.isArray(res20.data.messages), `Messages: ${res20.data.count}`);
    }

    // 21. POST /enquiries (Customer 1-Tap Reverse Enquiry)
    const res21 = await api('/enquiries', 'POST', {
      query: 'Need 10 packs of Amul butter 100g urgent',
      category: 'Dairy, Milk & Bakery',
      budget: 500,
      latitude: 21.1702,
      longitude: 72.8311
    }, customerToken);
    enquiryId = res21.data.enquiry?.id;
    record('POST /enquiries (Broadcast Enquiry)', res21.ok && !!enquiryId, `Enquiry ID: ${enquiryId}`);

    // 22. GET /enquiries/my (Customer Lists My Enquiries)
    const res22 = await api('/enquiries/my', 'GET', null, customerToken);
    record('GET /enquiries/my (Customer Active Enquiries)', res22.ok && Array.isArray(res22.data.enquiries), `Count: ${res22.data.count}`);

    // 23. GET /enquiries/nearby (Dukandar Lists Nearby Enquiries)
    const res23 = await api('/enquiries/nearby?lat=21.1702&lng=72.8311&radius=5', 'GET', null, dukandarToken);
    record('GET /enquiries/nearby (Merchant Radar Bids)', res23.ok && Array.isArray(res23.data.enquiries), `Nearby: ${res23.data.count}`);

    // 24. POST /enquiries/:id/bid (Dukandar Submits Price Quote)
    if (enquiryId) {
      const res24 = await api(`/enquiries/${enquiryId}/bid`, 'POST', {
        price: 480,
        message: 'Available at counter ready for pickup in 5 mins',
        store_id: dukandarStore?.id
      }, dukandarToken);
      record('POST /enquiries/:id/bid (Counter Price Quote)', res24.ok, `Quote status: ${res24.status}`);
    }

    // 25. POST /reviews (Customer Submits Store Review)
    if (dukandarStore?.id) {
      const res25 = await api('/reviews', 'POST', {
        store_id: dukandarStore.id,
        rating: 5,
        comment: 'Great store, items always fresh and ready!'
      }, customerToken);
      record('POST /reviews (Customer Store Review)', res25.ok, `Review ID: ${res25.data.review?.id}`);
    }

    // 26. GET /reviews/store/:storeId (Store Reviews List)
    if (dukandarStore?.id) {
      const res26 = await api(`/reviews/store/${dukandarStore.id}`);
      record('GET /reviews/store/:id (Reviews & Average)', res26.ok && Array.isArray(res26.data.reviews), `Avg: ${res26.data.average_rating}`);
    }

    // 27. POST /offers (Dukandar Adds Offer / Deal)
    if (dukandarStore?.id) {
      const res27 = await api('/offers', 'POST', {
        store_id: dukandarStore.id,
        title: 'FLAT 15% OFF ON MILK PRODUCTS',
        discount_type: 'FLAT 15%',
        discount_percentage: 15
      }, dukandarToken);
      record('POST /offers (Create Store Deal)', res27.ok, `Deal ID: ${res27.data.offer?.id}`);
    }

    // 28. GET /offers (List Offers)
    const res28 = await api('/offers');
    record('GET /offers (Public Deals & Offers)', res28.ok && Array.isArray(res28.data.offers), `Offers: ${res28.data.count}`);

    // 29. Role Mismatch Test 1: Dukandar credentials on Customer login
    const res29 = await api('/auth/login', 'POST', {
      email: dukandarEmail,
      password,
      expected_role: 'customer'
    });
    // Should warn or identify dukandar account
    record('ROLE ENFORCEMENT: Dukandar logging in as Customer', res29.data.user?.role === 'dukandar', `Identifies account as: ${res29.data.user?.role}`);

    // 30. Role Mismatch Test 2: Customer credentials on Dukandar login
    const res30 = await api('/auth/login', 'POST', {
      email: customerEmail,
      password,
      expected_role: 'dukandar'
    });
    record('ROLE ENFORCEMENT: Customer logging in as Dukandar', res30.data.user?.role === 'customer', `Identifies account as: ${res30.data.user?.role}`);

  } catch (err) {
    console.error('Fatal test error:', err);
  }

  console.log(`\nAUDIT SUMMARY FOR ${baseUrl}:`);
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);
  console.log(`Success Rate: ${Math.round((passed / (passed + failed || 1)) * 100)}%\n`);

  return { passed, failed, results };
}

async function main() {
  for (const url of BASE_URLS) {
    await runTestSuite(url);
  }
}

main().catch(console.error);
