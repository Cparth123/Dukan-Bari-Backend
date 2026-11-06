const { db, isMock } = require('../config/firebase');
const { User, Store, Product, Offer, Enquiry, Review } = require('../models');

async function seed() {
  console.log('====================================================');
  console.log('       DUKAN BARI - FIREBASE DB SEEDER              ');
  console.log(`       Mode: ${isMock ? 'In-Memory / Local DB' : 'Cloud Firestore'} `);
  console.log('====================================================\n');

  try {
    // 1. Seed Demo Users
    console.log('[1/6] Seeding Users...');
    const superadmin = await User.create({
      id: 'usr_superadmin_01',
      email: 'parthchauhan417418@gmail.com',
      phone: '+919876543210',
      full_name: 'Parth Chauhan (Superadmin)',
      role: 'superadmin'
    });

    const dukandar1 = await User.create({
      id: 'usr_dukandar_01',
      email: 'dukandar.sharma@dukanbari.com',
      phone: '+919876543211',
      full_name: 'Ramesh Sharma',
      role: 'dukandar'
    });

    const dukandar2 = await User.create({
      id: 'usr_dukandar_02',
      email: 'dukandar.gupta@dukanbari.com',
      phone: '+919876543212',
      full_name: 'Vikram Gupta',
      role: 'dukandar'
    });

    const customer1 = await User.create({
      id: 'usr_customer_01',
      email: 'customer.priya@gmail.com',
      phone: '+919876543213',
      full_name: 'Priya Verma',
      role: 'customer'
    });
    console.log(`✓ 4 Users created (Superadmin, Dukandars, Customer)`);

    // 2. Seed Stores
    console.log('[2/6] Seeding Stores...');
    const store1 = await Store.create({
      id: 'str_sharma_kirana_01',
      owner_id: dukandar1.id,
      name: 'Sharma Super Kirana & Daily Needs',
      description: 'Your neighborhood trusted grocery store. Fresh pulses, spices, dairy and instant delivery.',
      category: 'Grocery',
      address: 'Shop 12, Sector 4 Market, Main Road',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      latitude: 28.6139,
      longitude: 77.2090,
      phone: '+919876543211',
      is_live_open: true,
      rating: 4.8,
      review_count: 142,
      banner_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
      logo_url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=400&q=80',
      is_verified: true
    });

    const store2 = await Store.create({
      id: 'str_gupta_electronics_02',
      owner_id: dukandar2.id,
      name: 'Gupta Digital & Mobile Hub',
      description: 'Authorized retailer for smartphones, smartwatches, high-speed chargers and accessories.',
      category: 'Electronics',
      address: 'Shop 45, Cyber Galleria, Sector 18',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      latitude: 28.6180,
      longitude: 77.2150,
      phone: '+919876543212',
      is_live_open: true,
      rating: 4.6,
      review_count: 89,
      banner_url: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80',
      logo_url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80',
      is_verified: true
    });
    console.log(`✓ 2 Verified Stores created`);

    // 3. Seed Products
    console.log('[3/6] Seeding Products...');
    const products = [
      {
        store_id: store1.id,
        name: 'Aashirvaad Shudh Chakki Atta (10kg)',
        description: '100% pure whole wheat flour, naturally rich in dietary fibre.',
        category: 'Grocery',
        price: 460,
        offer_price: 420,
        unit: 'packet',
        in_stock: true,
        image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80'
      },
      {
        store_id: store1.id,
        name: 'Fortune Sunlite Refined Sunflower Oil (1L)',
        description: 'Light, healthy cooking oil enriched with vitamins A & D.',
        category: 'Grocery',
        price: 155,
        offer_price: 139,
        unit: 'packet',
        in_stock: true,
        image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80'
      },
      {
        store_id: store1.id,
        name: 'Tata Premium Tea (1kg)',
        description: 'Finest handpicked leaves with delicious aroma and strong flavor.',
        category: 'Grocery',
        price: 520,
        offer_price: 475,
        unit: 'packet',
        in_stock: true,
        image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80'
      },
      {
        store_id: store2.id,
        name: 'Boat Bassheads 100 Wired Earphones',
        description: 'Super extra bass, in-line microphone with 1.2m tangle-free cable.',
        category: 'Electronics',
        price: 999,
        offer_price: 399,
        unit: 'piece',
        in_stock: true,
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80'
      },
      {
        store_id: store2.id,
        name: 'Mi 65W Fast Charger (Type-C)',
        description: 'GaN technology universal fast charger with multi-layer surge protection.',
        category: 'Electronics',
        price: 1899,
        offer_price: 1499,
        unit: 'piece',
        in_stock: true,
        image_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80'
      }
    ];

    for (const p of products) {
      await Product.create(p);
    }
    console.log(`✓ ${products.length} Products seeded across stores`);

    // 4. Seed Active Flash Deals
    console.log('[4/6] Seeding Offers...');
    await Offer.create({
      store_id: store1.id,
      title: 'Flat 10% Off on Monthly Grocery',
      description: 'Spend ₹1,500 or more and get instant 10% off at checkout counter.',
      discount_pct: 10,
      code: 'KIRANA10',
      banner_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80',
      is_active: true
    });

    await Offer.create({
      store_id: store2.id,
      title: 'Festival Mobile Accessories Dhamaka',
      description: 'Buy any phone cover and get tempered glass at 50% discount.',
      discount_pct: 50,
      code: 'FESTIVAL50',
      banner_url: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=800&q=80',
      is_active: true
    });
    console.log(`✓ 2 Flash Offers created`);

    // 5. Seed Reverse Enquiry
    console.log('[5/6] Seeding Reverse Enquiry...');
    const enquiry = await Enquiry.create({
      customer_id: customer1.id,
      category: 'Electronics',
      query: 'Need 65W fast charger compatible with OnePlus 11',
      description: 'Urgent requirement, can pick up immediately from nearby market.',
      budget: 1500,
      latitude: 28.6145,
      longitude: 77.2095,
      radius_km: 5
    });

    await Enquiry.addResponse({
      enquiry_id: enquiry.id,
      store_id: store2.id,
      message: 'Original Mi 65W GaN fast charger ready for pickup at our Sector 18 counter.',
      price: 1450
    });
    console.log(`✓ 1 Reverse Customer Enquiry & 1 Merchant Bid created`);

    // 6. Seed Store Review
    console.log('[6/6] Seeding Reviews...');
    await Review.create({
      store_id: store1.id,
      user_id: customer1.id,
      user_name: 'Priya Verma',
      rating: 5,
      comment: 'Best quality grains and very polite shopkeeper. Always fresh stock!'
    });
    console.log(`✓ 1 Store Review created`);

    console.log('\n====================================================');
    console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
    console.log('   All Supabase tables have been created and populated in Firebase!');
    console.log('====================================================');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();

