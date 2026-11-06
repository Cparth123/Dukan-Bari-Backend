const admin = require('../../../backend/node_modules/firebase-admin');
const sa = require('../../../backend/serviceAccountKey.json');

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

const fullSchemaGql = `
type User @table {
  email: String
  phone: String
  fullName: String!
  role: String!
  avatarUrl: String
  createdAt: Timestamp @default(expr: "request.time")
}

type Store @table {
  owner: User!
  name: String!
  category: String!
  businessOfferingType: String
  address: String
  state: String
  city: String
  pincode: String
  phone: String
  whatsappNumber: String
  standardOpenTime: String
  standardCloseTime: String
  specialScheduleDate: String
  specialScheduleNote: String
  latitude: Float
  longitude: Float
  isLiveOpen: Boolean!
  rating: Float
  reviewCount: Int
  bannerUrl: String
  logoUrl: String
  description: String
  createdAt: Timestamp @default(expr: "request.time")
}

type Product @table {
  store: Store!
  name: String!
  description: String
  price: Float!
  salePrice: Float
  category: String
  imageUrl: String
  inStock: Boolean!
  createdAt: Timestamp @default(expr: "request.time")
}

type Offer @table {
  store: Store!
  title: String!
  description: String
  discountTag: String
  radiusKm: Float
  isActive: Boolean!
  createdAt: Timestamp @default(expr: "request.time")
}

type Enquiry @table {
  customer: User!
  category: String
  query: String!
  description: String
  budget: Float
  latitude: Float
  longitude: Float
  radiusKm: Float
  status: String!
  createdAt: Timestamp @default(expr: "request.time")
}

type StoreReview @table {
  store: Store!
  user: User!
  userName: String!
  rating: Int!
  comment: String
  createdAt: Timestamp @default(expr: "request.time")
}

type Conversation @table {
  store: Store!
  customer: User!
  createdAt: Timestamp @default(expr: "request.time")
}

type Message @table {
  conversation: Conversation!
  sender: User!
  senderRole: String!
  text: String!
  mediaUrl: String
  mediaType: String
  isRead: Boolean @default(value: false)
  createdAt: Timestamp @default(expr: "request.time")
}
`;

async function deploySchema() {
  const token = (await admin.credential.cert(sa).getAccessToken()).access_token;
  const url = 'https://firebasedataconnect.googleapis.com/v1beta/projects/dukan-bari/locations/asia-east1/services/dukan-bari-service/schemas/main?updateMask=source';

  const body = {
    source: {
      files: [
        {
          path: 'schema.gql',
          content: fullSchemaGql
        }
      ]
    }
  };

  console.log('Deploying schema to Firebase Data Connect schemas/main...');
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  console.log('Deploy response:', JSON.stringify(data, null, 2));
}

deploySchema().catch(console.error);

