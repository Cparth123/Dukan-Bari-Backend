const { executeDataConnect } = require('../config/dataconnect');
const { db } = require('../config/firebase');

async function clearAllData() {
  console.log('========================================================');
  console.log('       CLEARING ALL FIREBASE DATA CONNECT TABLES        ');
  console.log('========================================================\n');

  // Order of deletion to respect foreign keys:
  // 1. StoreReview, Product, Offer, Enquiry -> 2. Store -> 3. User

  // 1. Delete Store Reviews
  try {
    const res = await executeDataConnect(`
      mutation ClearReviews {
        storeReview_deleteMany(all: true)
      }
    `);
    console.log('[CLEAR] StoreReviews:', JSON.stringify(res.data || res.errors));
  } catch (e) {
    console.warn('[CLEAR] StoreReviews notice:', e.message);
  }

  // 2. Delete Offers
  try {
    const res = await executeDataConnect(`
      mutation ClearOffers {
        offer_deleteMany(all: true)
      }
    `);
    console.log('[CLEAR] Offers:', JSON.stringify(res.data || res.errors));
  } catch (e) {
    console.warn('[CLEAR] Offers notice:', e.message);
  }

  // 3. Delete Products
  try {
    const res = await executeDataConnect(`
      mutation ClearProducts {
        product_deleteMany(all: true)
      }
    `);
    console.log('[CLEAR] Products:', JSON.stringify(res.data || res.errors));
  } catch (e) {
    console.warn('[CLEAR] Products notice:', e.message);
  }

  // 4. Delete Enquiries
  try {
    const res = await executeDataConnect(`
      mutation ClearEnquiries {
        enquiry_deleteMany(all: true)
      }
    `);
    console.log('[CLEAR] Enquiries:', JSON.stringify(res.data || res.errors));
  } catch (e) {
    console.warn('[CLEAR] Enquiries notice:', e.message);
  }

  // 5. Delete Stores
  try {
    const res = await executeDataConnect(`
      mutation ClearStores {
        store_deleteMany(all: true)
      }
    `);
    console.log('[CLEAR] Stores:', JSON.stringify(res.data || res.errors));
  } catch (e) {
    console.warn('[CLEAR] Stores notice:', e.message);
  }

  // 6. Delete Users
  try {
    const res = await executeDataConnect(`
      mutation ClearUsers {
        user_deleteMany(all: true)
      }
    `);
    console.log('[CLEAR] Users:', JSON.stringify(res.data || res.errors));
  } catch (e) {
    console.warn('[CLEAR] Users notice:', e.message);
  }

  // Also clear local memory store
  if (db && db._memoryStore) {
    db._memoryStore.clear();
    console.log('[CLEAR] Local memory store cleared.');
  }

  console.log('\n========================================================');
  console.log('        ALL TABLE DATA HAS BEEN CLEARED!                ');
  console.log('========================================================\n');
}

clearAllData().catch(console.error);
