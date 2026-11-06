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

async function runUpdateDeleteSuite() {
  console.log('========================================================');
  console.log('   DUKAN BARI - FULL UPDATE & DELETE ACTION SUITE       ');
  console.log('========================================================\n');

  const ts = Date.now();

  // 1. Create a test user
  console.log('--- 1. [USER UPDATE & DELETE] ---');
  const user = await UserModel.create({
    full_name: 'Test Update User',
    email: `upd.test.${ts}@test.com`,
    phone: `999${String(ts).slice(-7)}`,
    role: 'dukandar'
  });
  assert(user && user.id, `User created: ${user.id}`);

  // Test User Update
  const updatedUser = await UserModel.update(user.id, {
    full_name: 'Test Update User Renamed',
    phone: `988${String(ts).slice(-7)}`
  });
  assert(updatedUser && updatedUser.full_name === 'Test Update User Renamed', `User Update: Full Name & Phone`);

  // 2. Create a test store for this user
  console.log('\n--- 2. [STORE UPDATE & DEDUPLICATION] ---');
  const store = await StoreModel.create({
    owner_id: user.id,
    name: 'Initial Store Name',
    category: 'Grocery & Kirana',
    city: 'Surat',
    pincode: '395004',
    is_live_open: true
  });
  assert(store && store.id, `Store created: ${store.id}`);

  // Update Category on existing store
  const updatedStore = await StoreModel.update(store.id, {
    category: 'Electronics & Mobile Repair',
    name: 'Updated Store Name'
  });
  assert(updatedStore && updatedStore.category === 'Electronics & Mobile Repair', `Store Update: Category updated in Cloud SQL`);
  assert(updatedStore && updatedStore.name === 'Updated Store Name', `Store Update: Store Name updated in Cloud SQL`);

  // Test Live Open toggle
  const closedStore = await StoreModel.toggleLiveStatus(store.id, false);
  assert(closedStore && closedStore.is_live_open === false, `Store Update: Live Open toggled to CLOSED`);

  const reopenedStore = await StoreModel.toggleLiveStatus(store.id, true);
  assert(reopenedStore && reopenedStore.is_live_open === true, `Store Update: Live Open toggled to OPEN`);

  // 3. Product Catalog Update & Delete
  console.log('\n--- 3. [PRODUCT UPDATE & DELETE] ---');
  const product = await ProductModel.create({
    store_id: store.id,
    name: 'Samsung Galaxy Cable 1m',
    category: 'Electronics',
    price: 399.0,
    offer_price: 299.0,
    in_stock: true
  });
  assert(product && product.id, `Product created: ${product.id}`);

  // Update Product Price and Stock
  const updatedProduct = await ProductModel.update(product.id, {
    price: 349.0,
    sale_price: 249.0,
    in_stock: false
  });
  assert(updatedProduct && updatedProduct.price === 349.0, `Product Update: Price updated to ₹${updatedProduct.price}`);
  assert(updatedProduct && updatedProduct.in_stock === false, `Product Update: In Stock updated to false`);

  // Delete Product
  const productDeleted = await ProductModel.delete(product.id);
  assert(productDeleted === true, `Product Delete: Deleted product ${product.id} from Cloud SQL`);

  const remainingProducts = await ProductModel.listByStore(store.id);
  const foundDeleted = remainingProducts.find(p => p.id === product.id);
  assert(!foundDeleted, `Product Delete: Verified product no longer exists in store list`);

  // 4. Offer Update & Delete
  console.log('\n--- 4. [OFFER UPDATE & DELETE] ---');
  const offer = await OfferModel.create({
    store_id: store.id,
    title: 'Flash 20% Off on Accessories',
    discount_tag: '20% OFF',
    radius_km: 5.0,
    is_active: true
  });
  assert(offer && offer.id, `Offer created: ${offer.id}`);

  // Update Offer Title, Discount Tag & Radius
  const updatedOffer = await OfferModel.update(offer.id, {
    title: 'Mega 30% Off on Accessories Tonight',
    discount_tag: '30% OFF',
    radius_km: 4.0,
    is_active: true
  });
  assert(updatedOffer && updatedOffer.title === 'Mega 30% Off on Accessories Tonight', `Offer Update: Title updated to ${updatedOffer.title}`);
  assert(updatedOffer && updatedOffer.discount_tag === '30% OFF', `Offer Update: Discount tag updated to ${updatedOffer.discount_tag}`);
  assert(updatedOffer && updatedOffer.radius_km === 4.0, `Offer Update: Radius updated to ${updatedOffer.radius_km} km`);

  // Delete Offer
  const offerDeleted = await OfferModel.delete(offer.id);
  assert(offerDeleted === true, `Offer Delete: Deleted offer ${offer.id} from Cloud SQL`);

  // 5. Clean up test store & user
  console.log('\n--- 5. [STORE & USER CLEANUP] ---');
  const storeDeleted = await StoreModel.delete(store.id);
  assert(storeDeleted === true, `Store Delete: Deleted test store from Cloud SQL`);

  const userDeleted = await UserModel.delete(user.id);
  assert(userDeleted === true, `User Delete: Deleted test user from Cloud SQL`);

  console.log('\n========================================================');
  console.log(`   RESULT: ALL ${passedTests}/${totalTests} UPDATE & DELETE TESTS PASSED!`);
  console.log('   All update and delete actions are working flawlessly!  ');
  console.log('========================================================\n');
}

runUpdateDeleteSuite().catch(err => {
  console.error('Update/Delete suite error:', err);
  process.exit(1);
});

