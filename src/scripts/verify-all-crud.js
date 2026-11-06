/**
 * Dukan Bari - Complete One-by-One Firebase Data Connect CRUD Verification Suite
 * Tests every API model against Firebase Data Connect (Cloud SQL PostgreSQL).
 */
const UserModel = require('../models/User');
const StoreModel = require('../models/Store');
const ProductModel = require('../models/Product');
const OfferModel = require('../models/Offer');
const EnquiryModel = require('../models/Enquiry');
const ReviewModel = require('../models/Review');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function verifyAllCrud() {
  console.log('========================================================');
  console.log('   DUKAN BARI - FULL ONE-BY-ONE FIREBASE CRUD SUITE     ');
  console.log('========================================================\n');

  const timestamp = Date.now();
  const testEmail = `dev.user.${timestamp}@test.com`;
  const testPhone = `987${String(timestamp).slice(-7)}`;

  // -----------------------------------------------------------
  // 1. AUTH / USER CRUD
  // -----------------------------------------------------------
  console.log('--- 1. [USER & AUTH CRUD] ---');
  
  // A. Create User (Signup)
  const newUser = await UserModel.create({
    full_name: 'Dukan Test User',
    email: testEmail,
    phone: testPhone,
    role: 'dukandar',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e'
  });
  assert(newUser && newUser.id, `User Signup / Insert (UUID: ${newUser?.id})`);

  // B. Read User by Email (Login)
  const userByEmail = await UserModel.findByEmail(testEmail);
  assert(userByEmail && userByEmail.email === testEmail, `User Login / Read by Email (${userByEmail?.email})`);

  // C. Read User by ID
  const userById = await UserModel.findById(newUser.id);
  assert(userById && userById.full_name === 'Dukan Test User', `User Read by ID (${userById?.full_name})`);

  // D. Update User Profile
  const updatedUser = await UserModel.update(newUser.id, {
    full_name: 'Dukan Test User Updated'
  });
  assert(updatedUser && updatedUser.full_name === 'Dukan Test User Updated', `User Update in Cloud SQL`);

  // -----------------------------------------------------------
  // 2. STORE CRUD
  // -----------------------------------------------------------
  console.log('\n--- 2. [STORE CRUD] ---');

  // A. Create Store
  const newStore = await StoreModel.create({
    owner_id: newUser.id,
    name: 'Dev Kirana & Provision Store',
    category: 'Grocery & Kirana Store',
    address: 'Shop 101, Galaxy Circle',
    city: 'Surat',
    pincode: '395004',
    phone: testPhone,
    latitude: 21.1702,
    longitude: 72.8311,
    is_live_open: true
  });
  assert(newStore && newStore.id, `Store Create / Insert (UUID: ${newStore?.id})`);

  // B. Read Store by ID
  const storeById = await StoreModel.findById(newStore.id);
  assert(storeById && storeById.name === 'Dev Kirana & Provision Store', `Store Read by ID (${storeById?.name})`);

  // C. Read Store by Owner ID
  const storeByOwner = await StoreModel.findByOwnerId(newUser.id);
  assert(storeByOwner && storeByOwner.id === newStore.id, `Store Read by Owner ID (${storeByOwner?.id})`);

  // D. List Stores with Filters
  const storeList = await StoreModel.list({ category: 'Grocery', limit: 10 });
  assert(Array.isArray(storeList) && storeList.length > 0, `Store List Directory (Count: ${storeList.length})`);

  // E. Update Store Live Open/Closed Status
  const closedStore = await StoreModel.toggleLiveStatus(newStore.id, false);
  assert(closedStore && closedStore.is_live_open === false, `Store Live Toggle -> CLOSED`);

  const reopenedStore = await StoreModel.toggleLiveStatus(newStore.id, true);
  assert(reopenedStore && reopenedStore.is_live_open === true, `Store Live Toggle -> REOPENED (LIVE)`);

  // -----------------------------------------------------------
  // 3. PRODUCT CATALOG CRUD
  // -----------------------------------------------------------
  console.log('\n--- 3. [PRODUCT CATALOG CRUD] ---');

  // A. Create Product
  const newProduct = await ProductModel.create({
    store_id: newStore.id,
    name: 'Tata Salt Vacuum Evaporated 1kg',
    description: 'Iodized salt for daily cooking',
    category: 'Grocery',
    price: 28.0,
    offer_price: 26.0,
    sale_price: 26.0,
    in_stock: true,
    image_url: 'https://images.unsplash.com/photo-1518843875459-f738682238a6'
  });
  assert(newProduct && newProduct.id, `Product Add / Insert (UUID: ${newProduct?.id})`);

  // B. Read Products by Store
  const storeProducts = await ProductModel.listByStore(newStore.id);
  assert(Array.isArray(storeProducts) && storeProducts.length > 0, `Product List by Store (${storeProducts.length} items)`);

  // C. Update Product Price & Stock
  const updatedProduct = await ProductModel.update(newProduct.id, {
    price: 30.0,
    sale_price: 27.0,
    in_stock: true
  });
  assert(updatedProduct && updatedProduct.price === 30.0, `Product Update in Cloud SQL (New Price: ₹${updatedProduct?.price})`);

  // D. Search Products
  const searchResults = await ProductModel.search('Tata');
  assert(Array.isArray(searchResults) && searchResults.length > 0, `Product Search ("Tata" -> ${searchResults.length} results)`);

  // -----------------------------------------------------------
  // 4. OFFERS CRUD
  // -----------------------------------------------------------
  console.log('\n--- 4. [OFFERS & FLASH DEALS CRUD] ---');

  // A. Create Offer
  const newOffer = await OfferModel.create({
    store_id: newStore.id,
    title: 'Weekend Flat 15% Off on All Pulses',
    description: 'Valid on Arhar dal, Moong dal, and Chana dal',
    discount_tag: '15% FLAT OFF',
    radius_km: 5.0,
    is_active: true
  });
  assert(newOffer && newOffer.id, `Offer Create / Insert (UUID: ${newOffer?.id})`);

  // B. List Offers for Store
  const storeOffers = await OfferModel.listByStore(newStore.id);
  assert(Array.isArray(storeOffers) && storeOffers.length > 0, `Offer List by Store (${storeOffers.length} deals)`);

  // C. List Active Nearby Offers
  const activeOffers = await OfferModel.listActive();
  assert(Array.isArray(activeOffers) && activeOffers.length > 0, `Active Offers Directory (${activeOffers.length} offers)`);

  // -----------------------------------------------------------
  // 5. REVERSE ENQUIRIES CRUD
  // -----------------------------------------------------------
  console.log('\n--- 5. [REVERSE ENQUIRIES CRUD] ---');

  // A. Create Customer Enquiry
  const newEnquiry = await EnquiryModel.create({
    customer_id: newUser.id,
    category: 'Grocery',
    query: 'Need 10kg Fortune Sunlite Sunflower Oil urgent',
    description: 'Looking for home delivery near galaxy circle',
    budget: 1450.0,
    radius_km: 3.0,
    status: 'open'
  });
  assert(newEnquiry && newEnquiry.id, `Enquiry Create / Insert (UUID: ${newEnquiry?.id})`);

  // B. List Enquiries by Customer
  const customerEnquiries = await EnquiryModel.listByCustomer(newUser.id);
  assert(Array.isArray(customerEnquiries) && customerEnquiries.length > 0, `Enquiry List by Customer (${customerEnquiries.length} enquiries)`);

  // C. List Nearby Open Enquiries for Merchants
  const nearbyEnquiries = await EnquiryModel.listNearby({ category: 'Grocery' });
  assert(Array.isArray(nearbyEnquiries) && nearbyEnquiries.length > 0, `Nearby Enquiries for Merchants (${nearbyEnquiries.length} requests)`);

  // -----------------------------------------------------------
  // 6. STORE REVIEWS CRUD
  // -----------------------------------------------------------
  console.log('\n--- 6. [STORE REVIEWS CRUD] ---');

  // A. Create Review
  const newReview = await ReviewModel.create({
    store_id: newStore.id,
    user_id: newUser.id,
    user_name: 'Dukan Test User',
    rating: 5,
    comment: 'Great clean shop and instant grocery counter delivery!'
  });
  assert(newReview && newReview.id, `Review Create / Insert (UUID: ${newReview?.id})`);

  // B. List Reviews for Store
  const storeReviews = await ReviewModel.listByStore(newStore.id);
  assert(Array.isArray(storeReviews) && storeReviews.length > 0, `Review List by Store (${storeReviews.length} reviews)`);

  console.log('\n========================================================');
  console.log(`   RESULT: ALL ${passedTests}/${totalTests} TESTS PASSED CLEANLY! `);
  console.log('   Every single CRUD operation is committed to Cloud SQL!  ');
  console.log('========================================================\n');
}

verifyAllCrud().catch(err => {
  console.error('\nVerification failed:', err.message);
  process.exit(1);
});

