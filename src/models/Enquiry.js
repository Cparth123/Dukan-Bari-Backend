const { db } = require('../config/firebase');
const { executeDataConnect, toUUID } = require('../config/dataconnect');
const { v4: uuidv4 } = require('uuid');

const COLLECTION_ENQUIRIES = 'enquiries';
const COLLECTION_RESPONSES = 'enquiry_responses';

class EnquiryModel {
  static sanitizeEnquiry(data) {
    return {
      id: data.id || uuidv4(),
      customer_id: String(data.customer_id || data.customerId || data.user_id),
      category: data.category || 'General',
      query: data.query || data.title || '',
      description: data.description || '',
      budget: parseFloat(data.budget) || 0,
      latitude: parseFloat(data.latitude) || 21.1702,
      longitude: parseFloat(data.longitude) || 72.8311,
      radius_km: parseFloat(data.radius_km || data.radiusKm) || 5,
      status: data.status || 'open', // 'open' | 'fulfilled' | 'closed'
      responses_count: parseInt(data.responses_count, 10) || 0,
      created_at: data.created_at || data.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  static sanitizeResponse(data) {
    return {
      id: data.id || uuidv4(),
      enquiry_id: String(data.enquiry_id || data.enquiryId),
      store_id: String(data.store_id || data.storeId),
      message: data.message || '',
      price: parseFloat(data.price) || 0,
      status: data.status || 'pending', // 'pending' | 'accepted' | 'declined'
      created_at: data.created_at || new Date().toISOString()
    };
  }

  static async findById(id) {
    if (!id) return null;
    const formattedId = toUUID(id);

    try {
      const q = `
        query FindEnquiryById($id: UUID!) {
          enquiries(where: { id: { eq: $id } }, limit: 1) {
            id
            customerId
            category
            query
            description
            budget
            latitude
            longitude
            radiusKm
            status
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { id: formattedId });
      if (res.data?.enquiries && res.data.enquiries.length > 0) {
        const e = res.data.enquiries[0];
        return {
          id: e.id,
          customer_id: e.customerId,
          category: e.category,
          query: e.query,
          description: e.description,
          budget: e.budget,
          latitude: e.latitude,
          longitude: e.longitude,
          radius_km: e.radiusKm,
          status: e.status,
          created_at: e.createdAt
        };
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] findById enquiry notice:', err.message);
    }

    const doc = await db.collection(COLLECTION_ENQUIRIES).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  static async create(enquiryData) {
    const enquiry = this.sanitizeEnquiry(enquiryData);
    const formattedCustomerId = toUUID(enquiry.customer_id);

    // 1. Commit to Firebase Data Connect (Cloud SQL)
    try {
      const mutation = `
        mutation CreateEnquiry(
          $customerId: UUID!
          $category: String
          $query: String!
          $description: String
          $budget: Float
          $latitude: Float
          $longitude: Float
          $radiusKm: Float
          $status: String!
        ) {
          enquiry_insert(data: {
            customerId: $customerId
            category: $category
            query: $query
            description: $description
            budget: $budget
            latitude: $latitude
            longitude: $longitude
            radiusKm: $radiusKm
            status: $status
          })
        }
      `;
      const res = await executeDataConnect(mutation, {
        customerId: formattedCustomerId,
        category: enquiry.category,
        query: enquiry.query,
        description: enquiry.description,
        budget: enquiry.budget,
        latitude: enquiry.latitude,
        longitude: enquiry.longitude,
        radiusKm: enquiry.radius_km,
        status: enquiry.status
      });

      if (res.data?.enquiry_insert?.id) {
        enquiry.id = res.data.enquiry_insert.id;
        console.log('[Firebase DataConnect] Successfully inserted Enquiry in Cloud SQL:', enquiry.id);
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] create enquiry error:', err.message);
    }

    // 2. Local fallback
    await db.collection(COLLECTION_ENQUIRIES).doc(String(enquiry.id)).set(enquiry);
    return enquiry;
  }

  static async listByCustomer(customerId) {
    if (!customerId) return [];
    const formattedCustomerId = toUUID(customerId);

    try {
      const q = `
        query ListEnquiriesByCustomer($customerId: UUID!) {
          enquiries(where: { customerId: { eq: $customerId } }) {
            id
            customerId
            category
            query
            description
            budget
            latitude
            longitude
            radiusKm
            status
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { customerId: formattedCustomerId });
      if (res.data?.enquiries) {
        return res.data.enquiries.map(e => ({
          id: e.id,
          customer_id: e.customerId,
          category: e.category,
          query: e.query,
          description: e.description,
          budget: e.budget,
          latitude: e.latitude,
          longitude: e.longitude,
          radius_km: e.radiusKm,
          status: e.status,
          created_at: e.createdAt
        }));
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] listByCustomer enquiries notice:', err.message);
    }

    const snap = await db.collection(COLLECTION_ENQUIRIES)
      .where('customer_id', '==', String(customerId))
      .get();
    return snap.docs.map(d => d.data());
  }

  static async listNearby({ lat, lng, radiusKm = 5, category } = {}) {
    try {
      const q = `
        query ListEnquiries {
          enquiries(where: { status: { eq: "open" } }, limit: 50) {
            id
            customerId
            category
            query
            description
            budget
            latitude
            longitude
            radiusKm
            status
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q);
      if (res.data?.enquiries && res.data.enquiries.length > 0) {
        let list = res.data.enquiries.map(e => ({
          id: e.id,
          customer_id: e.customerId,
          category: e.category,
          query: e.query,
          description: e.description,
          budget: e.budget,
          latitude: e.latitude,
          longitude: e.longitude,
          radius_km: e.radiusKm,
          status: e.status,
          created_at: e.createdAt
        }));
        if (category && category !== 'All') {
          list = list.filter(e => (e.category || '').toLowerCase().includes(category.toLowerCase()));
        }
        return list;
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] listNearby enquiries notice:', err.message);
    }

    let query = db.collection(COLLECTION_ENQUIRIES).where('status', '==', 'open');
    if (category && category !== 'All') {
      query = query.where('category', '==', category);
    }
    const snap = await query.limit(50).get();
    return snap.docs.map(d => d.data());
  }

  static async addResponse(responseData) {
    const response = this.sanitizeResponse(responseData);
    await db.collection(COLLECTION_RESPONSES).doc(response.id).set(response);

    const enquiryDoc = await db.collection(COLLECTION_ENQUIRIES).doc(response.enquiry_id).get();
    if (enquiryDoc.exists) {
      const current = enquiryDoc.data().responses_count || 0;
      await db.collection(COLLECTION_ENQUIRIES).doc(response.enquiry_id).update({
        responses_count: current + 1
      });
    }

    return response;
  }

  static async listResponses(enquiryId) {
    if (!enquiryId) return [];
    const snap = await db.collection(COLLECTION_RESPONSES)
      .where('enquiry_id', '==', String(enquiryId))
      .get();
    return snap.docs.map(d => d.data());
  }

  static async close(id) {
    const formattedId = toUUID(id);
    try {
      const mutation = `
        mutation CloseEnquiry($id: UUID!) {
          enquiry_update(id: $id, data: { status: "closed" })
        }
      `;
      await executeDataConnect(mutation, { id: formattedId });
    } catch (e) { }

    await db.collection(COLLECTION_ENQUIRIES).doc(String(id)).update({ status: 'closed' });
    return true;
  }
}

module.exports = EnquiryModel;
