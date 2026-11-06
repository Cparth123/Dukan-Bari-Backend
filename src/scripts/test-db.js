const { User, Store, Product, Conversation, Message, Enquiry, Offer, Review } = require('../models');

async function testDatabase() {
  console.log('========================================================');
  console.log('       DUKAN BARI - FIREBASE DB VERIFICATION SUITE       ');
  console.log('========================================================\n');

  // Ensure baseline seed exists in test runtime
  const testUser = await User.findByEmail('parthchauhan417418@gmail.com');
  if (!testUser) {
    console.log('[Test Setup] Populating baseline test data...');
    await User.create({
      id: 'usr_superadmin_01',
      email: 'parthchauhan417418@gmail.com',
      full_name: 'Parth Chauhan (Superadmin)',
      role: 'superadmin'
    });
    await Store.create({
      id: 'str_sharma_kirana_01',
      name: 'Sharma Super Kirana',
      category: 'Grocery',
      latitude: 28.6139,
      longitude: 77.2090,
      is_live_open: true,
      rating: 4.8
    });
    await Product.create({
      store_id: 'str_sharma_kirana_01',
      name: 'Aashirvaad Atta (10kg)',
      category: 'Grocery',
      price: 420
    });
    await Product.create({
      store_id: 'str_sharma_kirana_01',
      name: 'Fortune Sunflower Oil (1L)',
      category: 'Grocery',
      price: 139
    });
    await Offer.create({
      store_id: 'str_sharma_kirana_01',
      title: 'Flat 10% Off',
      discount_pct: 10,
      is_active: true
    });
    const enq = await Enquiry.create({
      customer_id: 'usr_superadmin_01',
      category: 'Electronics',
      query: 'Need fast charger',
      latitude: 28.6140,
      longitude: 77.2091,
      radius_km: 5
    });
    await Enquiry.addResponse({
      enquiry_id: enq.id,
      store_id: 'str_sharma_kirana_01',
      message: 'Available in stock',
      price: 500
    });
    await Review.create({
      store_id: 'str_sharma_kirana_01',
      user_id: 'usr_superadmin_01',
      rating: 5,
      comment: 'Excellent shop!'
    });
  }

  let passed = 0;
  let total = 0;

  async function assertTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${name}: ${e.message}`);
    }
  }

  // Test 1: User Model
  await assertTest('User.findByEmail returns existing user', async () => {
    const user = await User.findByEmail('parthchauhan417418@gmail.com');
    if (!user || user.role !== 'superadmin') throw new Error('Expected superadmin user');
  });

  // Test 2: Store Model
  await assertTest('Store.findById & toggleLiveStatus', async () => {
    const store = await Store.findById('str_sharma_kirana_01');
    if (!store) throw new Error('Store not found');
    const updated = await Store.toggleLiveStatus(store.id, false);
    if (updated.is_live_open !== false) throw new Error('Failed to toggle live status');
    await Store.toggleLiveStatus(store.id, true);
  });

  // Test 3: Hyperlocal Distance Radar
  await assertTest('Store.findNearby returns stores sorted by distance', async () => {
    const nearby = await Store.findNearby({ lat: 28.6139, lng: 77.2090, radiusKm: 10 });
    if (!Array.isArray(nearby) || nearby.length === 0) throw new Error('No nearby stores found');
    if (nearby[0].distance_km === undefined) throw new Error('Missing distance_km calculation');
  });

  // Test 4: Product Model
  await assertTest('Product.listByStore returns store catalog', async () => {
    const prods = await Product.listByStore('str_sharma_kirana_01');
    if (prods.length < 2) throw new Error('Expected at least 2 grocery products');
  });

  // Test 5: Offer Model
  await assertTest('Offer.listActive returns active offers', async () => {
    const offers = await Offer.listActive();
    if (offers.length === 0) throw new Error('Expected active offers');
  });

  // Test 6: Enquiry Model & Bids
  await assertTest('Enquiry.listNearby and listResponses', async () => {
    const enquiries = await Enquiry.listNearby({ lat: 28.6139, lng: 77.2090, radiusKm: 5 });
    if (enquiries.length === 0) throw new Error('Expected open enquiry');
    const responses = await Enquiry.listResponses(enquiries[0].id);
    if (responses.length === 0) throw new Error('Expected merchant responses');
  });

  // Test 7: Conversation & Chat Messages
  await assertTest('Conversation.findOrCreate and Message.create', async () => {
    const conv = await Conversation.findOrCreate({
      customer_id: 'usr_customer_01',
      store_id: 'str_sharma_kirana_01'
    });
    if (!conv) throw new Error('Failed to create conversation');

    const msg = await Message.create({
      conversation_id: conv.id,
      sender_id: 'usr_customer_01',
      sender_role: 'customer',
      text: 'Is fresh Amul milk available?'
    });
    if (!msg || msg.text !== 'Is fresh Amul milk available?') throw new Error('Failed to create message');

    const list = await Message.listByConversation(conv.id);
    if (list.length === 0) throw new Error('Failed to list messages');
  });

  // Test 8: Store Reviews & Dynamic Average Rating
  await assertTest('Review.listByStore returns reviews', async () => {
    const reviews = await Review.listByStore('str_sharma_kirana_01');
    if (reviews.length === 0) throw new Error('Expected reviews for store');
    if (reviews[0].rating !== 5) throw new Error('Expected rating 5');
  });

  console.log('\n--------------------------------------------------------');
  console.log(`Results: ${passed}/${total} tests passed!`);
  console.log('--------------------------------------------------------\n');

  if (passed !== total) {
    process.exit(1);
  }
}

testDatabase();
