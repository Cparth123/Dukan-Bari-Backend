const admin = require('../../../backend/node_modules/firebase-admin');
const sa = require('../../../backend/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

async function runGraphQL(query, variables = {}) {
  const token = (await admin.credential.cert(sa).getAccessToken()).access_token;
  const endpoint = 'https://firebasedataconnect.googleapis.com/v1beta/projects/dukan-bari/locations/asia-east1/services/dukan-bari-service:executeGraphql';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });

  return await res.json();
}

async function main() {
  console.log('========================================================');
  console.log('   FIREBASE DATA CONNECT - EXECUTING QUERY & MUTATION   ');
  console.log('========================================================\n');

  // 1. Insert User Mutation
  console.log('[1/3] Executing user_insert mutation...');
  const insertMutation = `
    mutation CreateDukandar {
      user_insert(data: {
        fullName: "d"
        email: "dev@test.com"
        phone: "9876543210"
        role: "dukandar"
      })
    }
  `;

  const insertResult = await runGraphQL(insertMutation);
  console.log('Insert Result:', JSON.stringify(insertResult, null, 2));

  // 2. Query All Users
  console.log('\n[2/3] Querying all users from Cloud SQL...');
  const queryUsers = `
    query GetAllUsers {
      users {
        id
        fullName
        email
        phone
        role
        createdAt
      }
    }
  `;

  const usersResult = await runGraphQL(queryUsers);
  console.log('Users in Database:', JSON.stringify(usersResult, null, 2));

  // 3. Insert Store Mutation for User
  console.log('\n[3/4] Inserting store "dev" for user in Cloud SQL...');
  const storeInsertMutation = `
    mutation CreateStore {
      store_insert(data: {
        ownerId: "813282f79b2448d6bf7130ec09a09125"
        name: "dev"
        category: "Grocery and Kirana Store"
        address: "Shop 14, Main Market, Sector 5"
        city: "Surat"
        pincode: "395004"
        phone: "9876543210"
        latitude: 21.1702
        longitude: 72.8311
        isLiveOpen: true
      })
    }
  `;
  const storeInsertResult = await runGraphQL(storeInsertMutation);
  console.log('Store Insert Result:', JSON.stringify(storeInsertResult, null, 2));

  // 4. Query All Stores
  console.log('\n[4/4] Querying all stores from Cloud SQL...');
  const queryStores = `
    query GetAllStores {
      stores {
        id
        name
        category
        city
        isLiveOpen
        createdAt
      }
    }
  `;
  const storesResult = await runGraphQL(queryStores);
  console.log('Stores in Database:', JSON.stringify(storesResult, null, 2));

  console.log('\n========================================================');
  console.log('                 EXECUTION SUCCESSFUL!                  ');
  console.log('========================================================');
}

main().catch(err => {
  console.error('Execution Error:', err);
  process.exit(1);
});
