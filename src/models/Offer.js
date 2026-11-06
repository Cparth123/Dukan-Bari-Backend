const { db } = require('../config/firebase');
const { executeDataConnect, toUUID } = require('../config/dataconnect');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'offers';

class OfferModel {
  static sanitize(data) {
    return {
      id: data.id || uuidv4(),
      store_id: String(data.store_id || data.storeId),
      title: data.title || '',
      description: data.description || '',
      discount_tag: data.discount_tag || data.discountTag || `${data.discount_pct || 20}% OFF`,
      radius_km: parseFloat(data.radius_km || data.radiusKm) || 5.0,
      banner_url: data.banner_url || data.bannerUrl || null,
      valid_until: data.valid_until || null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : (data.isActive !== undefined ? Boolean(data.isActive) : true),
      created_at: data.created_at || data.createdAt || new Date().toISOString()
    };
  }

  static async findById(id) {
    if (!id) return null;
    const formattedId = toUUID(id);

    // 1. Try Firebase Data Connect
    try {
      const q = `
        query FindOfferById($id: UUID!) {
          offer(id: $id) {
            id
            storeId
            title
            description
            discountTag
            radiusKm
            isActive
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { id: formattedId });
      if (res.data?.offer) {
        const o = res.data.offer;
        return {
          id: o.id,
          store_id: o.storeId,
          title: o.title,
          description: o.description,
          discount_tag: o.discountTag,
          radius_km: o.radiusKm,
          is_active: o.isActive,
          created_at: o.createdAt
        };
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] findById offer notice:', err.message);
    }

    // 2. Fallback
    const doc = await db.collection(COLLECTION).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  static async listByStore(storeId) {
    if (!storeId) return [];
    const formattedStoreId = toUUID(storeId);

    // 1. Try Firebase Data Connect
    try {
      const q = `
        query ListOffersByStore($storeId: UUID!) {
          offers(where: { storeId: { eq: $storeId } }) {
            id
            storeId
            title
            description
            discountTag
            radiusKm
            isActive
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { storeId: formattedStoreId });
      if (res.data?.offers) {
        return res.data.offers.map(o => ({
          id: o.id,
          store_id: o.storeId,
          title: o.title,
          description: o.description,
          discount_tag: o.discountTag,
          radius_km: o.radiusKm,
          is_active: o.isActive,
          created_at: o.createdAt
        }));
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] listByStore offers notice:', err.message);
    }

    // 2. Fallback
    const snap = await db.collection(COLLECTION)
      .where('store_id', '==', String(storeId))
      .get();
    return snap.docs.map(d => d.data());
  }

  static async listActive({ limit = 50 } = {}) {
    // 1. Try Firebase Data Connect
    try {
      const q = `
        query ListActiveOffers {
          offers(where: { isActive: { eq: true } }, limit: ${limit}) {
            id
            storeId
            title
            description
            discountTag
            radiusKm
            isActive
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q);
      if (res.data?.offers && res.data.offers.length > 0) {
        return res.data.offers.map(o => ({
          id: o.id,
          store_id: o.storeId,
          title: o.title,
          description: o.description,
          discount_tag: o.discountTag,
          radius_km: o.radiusKm,
          is_active: o.isActive,
          created_at: o.createdAt
        }));
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] listActive offers notice:', err.message);
    }

    const snap = await db.collection(COLLECTION)
      .where('is_active', '==', true)
      .limit(limit)
      .get();
    return snap.docs.map(d => d.data());
  }

  static async create(offerData) {
    const offer = this.sanitize(offerData);
    const formattedStoreId = toUUID(offer.store_id);

    // 1. Commit to Firebase Data Connect (Cloud SQL)
    try {
      const mutation = `
        mutation CreateOffer(
          $storeId: UUID!
          $title: String!
          $description: String
          $discountTag: String
          $radiusKm: Float
          $isActive: Boolean!
        ) {
          offer_insert(data: {
            storeId: $storeId
            title: $title
            description: $description
            discountTag: $discountTag
            radiusKm: $radiusKm
            isActive: $isActive
          })
        }
      `;
      const res = await executeDataConnect(mutation, {
        storeId: formattedStoreId,
        title: offer.title,
        description: offer.description,
        discountTag: offer.discount_tag,
        radiusKm: offer.radius_km,
        isActive: offer.is_active
      });
      if (res.data?.offer_insert?.id) {
        offer.id = res.data.offer_insert.id;
        console.log('[Firebase DataConnect] Successfully inserted Offer in Cloud SQL:', offer.id);
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] create offer error:', err.message);
    }

    // 2. Save locally / Firestore cache
    await db.collection(COLLECTION).doc(String(offer.id)).set(offer);
    return offer;
  }

  static async update(id, updates) {
    const formattedId = toUUID(id);
    const cleanUpdates = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    delete cleanUpdates.id;

    // 1. Update in Firebase Data Connect (Cloud SQL)
    try {
      const dataPayload = {};
      if (updates.title) dataPayload.title = updates.title;
      if (updates.description !== undefined) dataPayload.description = updates.description;
      if (updates.discount_tag !== undefined || updates.discountTag !== undefined) {
        dataPayload.discountTag = updates.discount_tag || updates.discountTag;
      }
      if (updates.radius_km !== undefined || updates.radiusKm !== undefined) {
        dataPayload.radiusKm = parseFloat(updates.radius_km !== undefined ? updates.radius_km : updates.radiusKm);
      }
      if (updates.is_active !== undefined || updates.isActive !== undefined) {
        dataPayload.isActive = Boolean(updates.is_active !== undefined ? updates.is_active : updates.isActive);
      }

      if (Object.keys(dataPayload).length > 0) {
        const mutation = `
          mutation UpdateOffer($id: UUID!, $data: Offer_Data!) {
            offer_update(id: $id, data: $data)
          }
        `;
        await executeDataConnect(mutation, { id: formattedId, data: dataPayload });
        console.log('[Firebase DataConnect] Successfully updated Offer in Cloud SQL:', id);
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] update offer error:', err.message);
    }

    // 2. Update Firestore / Cache
    await db.collection(COLLECTION).doc(String(id)).set(cleanUpdates, { merge: true });
    return this.findById(id);
  }

  static async delete(id) {
    const formattedId = toUUID(id);
    try {
      const mutation = `
        mutation DeleteOffer($id: UUID!) {
          offer_delete(id: $id)
        }
      `;
      await executeDataConnect(mutation, { id: formattedId });
      console.log('[Firebase DataConnect] Successfully deleted Offer from Cloud SQL:', id);
    } catch (err) {
      console.warn('[Firebase DataConnect] delete offer error:', err.message);
    }
    await db.collection(COLLECTION).doc(String(id)).delete();
    return true;
  }
}

module.exports = OfferModel;
