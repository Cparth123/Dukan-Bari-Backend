const admin = require('../../../backend/node_modules/firebase-admin');
const sa = require('../../../backend/serviceAccountKey.json');

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

async function run() {
  const token = (await admin.credential.cert(sa).getAccessToken()).access_token;
  const endpoint = 'https://firebasedataconnect.googleapis.com/v1beta/projects/dukan-bari/locations/asia-east1/services/dukan-bari-service:executeGraphql';

  async function gql(query, variables = {}) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables })
    });
    return res.json();
  }

  // 1. Test filtering users by email
  const q1 = await gql(`
    query GetUserByEmail($email: String!) {
      users(where: { email: { eq: $email } }) {
        id
        fullName
        email
        phone
        role
        createdAt
      }
    }
  `, { email: 'dev@test.com' });
  console.log('Query user by email:', JSON.stringify(q1, null, 2));

  // 2. Test getting stores with owner
  const q2 = await gql(`
    query GetStores {
      stores {
        id
        name
        category
        city
        isLiveOpen
        owner {
          id
          fullName
          email
        }
      }
    }
  `);
  console.log('Query stores with owner:', JSON.stringify(q2, null, 2));

  // 3. Test insert product
  if (q2.data && q2.data.stores && q2.data.stores.length > 0) {
    const rawStoreId = q2.data.stores[0].id;
    // Format to 8-4-4-4-12 UUID format if needed
    const formattedStoreId = rawStoreId.includes('-')
      ? rawStoreId
      : `${rawStoreId.slice(0, 8)}-${rawStoreId.slice(8, 12)}-${rawStoreId.slice(12, 16)}-${rawStoreId.slice(16, 20)}-${rawStoreId.slice(20)}`;

    const pInsert = await gql(`
      mutation AddProduct($storeId: UUID!, $name: String!, $price: Float!) {
        product_insert(data: {
          storeId: $storeId
          name: $name
          price: $price
          inStock: true
          category: "Grocery"
        })
      }
    `, { storeId: formattedStoreId, name: 'Aashirvaad Shudh Chakki Atta 5kg', price: 245.0 });
    console.log('Product insert result:', JSON.stringify(pInsert, null, 2));

    const pQuery = await gql(`
      query GetProducts($storeId: UUID!) {
        products(where: { storeId: { eq: $storeId } }) {
          id
          name
          price
          inStock
          category
        }
      }
    `, { storeId: formattedStoreId });
    console.log('Products for store:', JSON.stringify(pQuery, null, 2));
  }
}

run().catch(console.error);
