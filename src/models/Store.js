const { db } = require('../config/firebase');
const { executeDataConnect, toUUID } = require('../config/dataconnect');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'stores';

class StoreModel {
  static sanitize(data) {
    const storeName = data.name || data.store_name || 'Local Dukan';
    const storeAddress = data.address || data.address_line || '';
    const storePhone = data.phone || data.phone_contact || '';

    return {
      id: data.id || uuidv4(),
      owner_id: data.owner_id || data.ownerId ? String(data.owner_id || data.ownerId) : null,
      name: storeName,
      store_name: storeName,
      description: data.description || '',
      category: data.category || 'General Store',
      business_offering_type: data.business_offering_type || data.businessOfferingType || data.offering_type || 'product_selling',
      address: storeAddress,
      address_line: storeAddress,
      state: data.state || 'Gujarat',
      city: data.city || 'Surat',
      pincode: data.pincode || '395004',
      latitude: typeof data.latitude === 'number' ? data.latitude : (parseFloat(data.latitude) || 21.1702),
      longitude: typeof data.longitude === 'number' ? data.longitude : (parseFloat(data.longitude) || 72.8311),
      phone: storePhone,
      phone_contact: storePhone,
      whatsapp_number: data.whatsapp_number || data.whatsappNumber || data.whatsapp || storePhone,
      standard_open_time: data.standard_open_time || data.standardOpenTime || data.open_time || data.openTime || '08:30 AM',
      standard_close_time: data.standard_close_time || data.standardCloseTime || data.close_time || data.closeTime || '10:00 PM',
      special_schedule_date: data.special_schedule_date || data.specialScheduleDate || '',
      special_schedule_note: data.special_schedule_note || data.specialScheduleNote || '',
      is_live_open: data.is_live_open !== undefined ? Boolean(data.is_live_open) : (data.isLiveOpen !== undefined ? Boolean(data.isLiveOpen) : true),
      rating: typeof data.rating === 'number' ? data.rating : (parseFloat(data.rating) || 4.5),
      review_count: parseInt(data.review_count || data.reviewCount, 10) || 0,
      banner_url: data.banner_url || data.bannerUrl || null,
      logo_url: data.logo_url || data.logoUrl || null,
      is_verified: data.is_verified !== undefined ? Boolean(data.is_verified) : true,
      created_at: data.created_at || data.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  static async findById(id) {
    if (!id) return null;
    const formattedId = toUUID(id);

    // 1. Try Firebase Data Connect
    try {
      const q = `
        query FindStoreById($id: UUID!) {
          stores(where: { id: { eq: $id } }, limit: 1) {
            id
            ownerId
            name
            category
            address
            city
            pincode
            phone
            latitude
            longitude
            isLiveOpen
            rating
            reviewCount
            bannerUrl
            logoUrl
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { id: formattedId });
      if (Array.isArray(res.data?.stores)) {
        if (res.data.stores.length === 0) return null;
        const s = res.data.stores[0];
        const cachedDoc = await db.collection(COLLECTION).doc(String(s.id)).get();
        const cached = cachedDoc.exists ? cachedDoc.data() : {};

        const storeObj = {
          ...cached,
          id: s.id,
          owner_id: s.ownerId,
          name: s.name,
          store_name: s.name,
          category: s.category,
          address: s.address,
          address_line: s.address,
          city: s.city,
          pincode: s.pincode,
          phone: s.phone,
          phone_contact: s.phone,
          latitude: s.latitude,
          longitude: s.longitude,
          is_live_open: s.isLiveOpen,
          rating: s.rating || cached.rating || 4.8,
          review_count: s.reviewCount || cached.review_count || 12,
          banner_url: s.bannerUrl || cached.banner_url,
          logo_url: s.logoUrl || cached.logo_url,
          created_at: s.createdAt,
          business_offering_type: cached.business_offering_type || 'product_selling',
          whatsapp_number: cached.whatsapp_number || s.phone,
          standard_open_time: cached.standard_open_time || '08:30 AM',
          standard_close_time: cached.standard_close_time || '10:00 PM',
          special_schedule_date: cached.special_schedule_date || '',
          special_schedule_note: cached.special_schedule_note || '',
          state: cached.state || 'Gujarat',
          description: cached.description || ''
        };
        await db.collection(COLLECTION).doc(String(s.id)).set(storeObj, { merge: true });
        return storeObj;
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] findById store notice:', err.message);
    }

    // 2. Fallback
    const doc = await db.collection(COLLECTION).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  static async findByOwnerId(ownerId) {
    if (!ownerId) return null;
    const formattedOwnerId = toUUID(ownerId);

    // 1. Try Firebase Data Connect
    try {
      const q = `
        query FindStoreByOwnerId($ownerId: UUID!) {
          stores(where: { ownerId: { eq: $ownerId } }, limit: 1) {
            id
            ownerId
            name
            category
            address
            city
            pincode
            phone
            latitude
            longitude
            isLiveOpen
            rating
            reviewCount
            bannerUrl
            logoUrl
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { ownerId: formattedOwnerId });
      if (Array.isArray(res.data?.stores)) {
        if (res.data.stores.length === 0) return null;
        const s = res.data.stores[0];
        const cachedDoc = await db.collection(COLLECTION).doc(String(s.id)).get();
        const cached = cachedDoc.exists ? cachedDoc.data() : {};

        const storeObj = {
          ...cached,
          id: s.id,
          owner_id: s.ownerId,
          name: s.name,
          store_name: s.name,
          category: s.category,
          address: s.address,
          address_line: s.address,
          city: s.city,
          pincode: s.pincode,
          phone: s.phone,
          phone_contact: s.phone,
          latitude: s.latitude,
          longitude: s.longitude,
          is_live_open: s.isLiveOpen,
          rating: s.rating || cached.rating || 4.8,
          review_count: s.reviewCount || cached.review_count || 12,
          banner_url: s.bannerUrl || cached.banner_url,
          logo_url: s.logoUrl || cached.logo_url,
          created_at: s.createdAt,
          business_offering_type: cached.business_offering_type || 'product_selling',
          whatsapp_number: cached.whatsapp_number || s.phone,
          standard_open_time: cached.standard_open_time || '08:30 AM',
          standard_close_time: cached.standard_close_time || '10:00 PM',
          special_schedule_date: cached.special_schedule_date || '',
          special_schedule_note: cached.special_schedule_note || '',
          state: cached.state || 'Gujarat',
          description: cached.description || ''
        };
        await db.collection(COLLECTION).doc(String(s.id)).set(storeObj, { merge: true });
        return storeObj;
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] findByOwnerId notice:', err.message);
    }

    // 2. Fallback
    const snap = await db.collection(COLLECTION)
      .where('owner_id', '==', String(ownerId))
      .limit(1)
      .get();
    return !snap.empty ? snap.docs[0].data() : null;
  }

  static async create(storeData) {
    const store = this.sanitize(storeData);
    const formattedOwnerId = toUUID(store.owner_id);

    // 1. Commit to Firebase Data Connect (Cloud SQL PostgreSQL)
    try {
      const mutation = `
        mutation CreateStore(
          $ownerId: UUID!
          $name: String!
          $category: String!
          $address: String
          $city: String
          $pincode: String
          $phone: String
          $latitude: Float
          $longitude: Float
          $isLiveOpen: Boolean!
        ) {
          store_insert(data: {
            ownerId: $ownerId
            name: $name
            category: $category
            address: $address
            city: $city
            pincode: $pincode
            phone: $phone
            latitude: $latitude
            longitude: $longitude
            isLiveOpen: $isLiveOpen
          })
        }
      `;
      const res = await executeDataConnect(mutation, {
        ownerId: formattedOwnerId,
        name: store.name,
        category: store.category,
        address: store.address,
        city: store.city,
        pincode: store.pincode,
        phone: store.phone,
        latitude: store.latitude,
        longitude: store.longitude,
        isLiveOpen: store.is_live_open
      });

      if (res.data?.store_insert?.id) {
        store.id = res.data.store_insert.id;
        console.log('[Firebase DataConnect] Successfully inserted Store in Cloud SQL:', store.id, store.name);
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] create store error:', err.message);
    }

    // 2. Save locally / Firestore cache
    await db.collection(COLLECTION).doc(String(store.id)).set(store);
    return store;
  }

  static async update(id, updates) {
    const formattedId = toUUID(id);
    const cleanUpdates = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    delete cleanUpdates.id;

    // 1. Update in Firebase Data Connect
    try {
      const dataPayload = {};
      if (updates.name || updates.store_name) dataPayload.name = updates.name || updates.store_name;
      if (updates.category) dataPayload.category = updates.category;
      if (updates.address || updates.address_line) dataPayload.address = updates.address || updates.address_line;
      if (updates.city) dataPayload.city = updates.city;
      if (updates.pincode) dataPayload.pincode = updates.pincode;
      if (updates.phone || updates.phone_contact) dataPayload.phone = updates.phone || updates.phone_contact;
      if (updates.latitude !== undefined) dataPayload.latitude = parseFloat(updates.latitude);
      if (updates.longitude !== undefined) dataPayload.longitude = parseFloat(updates.longitude);
      if (updates.is_live_open !== undefined) dataPayload.isLiveOpen = Boolean(updates.is_live_open);
      if (updates.banner_url || updates.bannerUrl) dataPayload.bannerUrl = updates.banner_url || updates.bannerUrl;
      if (updates.logo_url || updates.logoUrl) dataPayload.logoUrl = updates.logo_url || updates.logoUrl;

      if (Object.keys(dataPayload).length > 0) {
        const mutation = `
          mutation UpdateStore($id: UUID!, $data: Store_Data!) {
            store_update(id: $id, data: $data)
          }
        `;
        await executeDataConnect(mutation, { id: formattedId, data: dataPayload });
        console.log('[Firebase DataConnect] Successfully updated Store in Cloud SQL:', id);
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] update store error:', err.message);
    }

    // 2. Update locally
    await db.collection(COLLECTION).doc(String(id)).set(cleanUpdates, { merge: true });
    return this.findById(id);
  }

  static async toggleLiveStatus(id, isOpen) {
    return this.update(id, { is_live_open: Boolean(isOpen) });
  }

  static async delete(id) {
    const formattedId = toUUID(id);
    try {
      const mutation = `
        mutation DeleteStore($id: UUID!) {
          store_delete(id: $id)
        }
      `;
      await executeDataConnect(mutation, { id: formattedId });
      console.log('[Firebase DataConnect] Successfully deleted Store from Cloud SQL:', id);
    } catch (err) {
      console.warn('[Firebase DataConnect] delete store error:', err.message);
    }
    await db.collection(COLLECTION).doc(String(id)).delete();
    return true;
  }

  static async list({ category, is_live_open, city, limit = 100, includeProducts = true } = {}) {
    // 1. Try Firebase Data Connect
    try {
      const q = `
        query ListStores {
          stores(limit: ${limit}) {
            id
            ownerId
            name
            category
            address
            city
            pincode
            phone
            latitude
            longitude
            isLiveOpen
            rating
            reviewCount
            bannerUrl
            logoUrl
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q);
      if (Array.isArray(res.data?.stores)) {
        let stores = res.data.stores.map(s => ({
          id: s.id,
          owner_id: s.ownerId,
          name: s.name,
          store_name: s.name,
          category: s.category,
          address: s.address,
          address_line: s.address,
          city: s.city,
          pincode: s.pincode,
          phone: s.phone,
          phone_contact: s.phone,
          latitude: s.latitude,
          longitude: s.longitude,
          is_live_open: s.isLiveOpen,
          rating: s.rating || 4.8,
          review_count: s.reviewCount || 12,
          banner_url: s.bannerUrl,
          logo_url: s.logoUrl,
          created_at: s.createdAt,
          products: []
        }));

        if (category && category !== 'All') {
          stores = stores.filter(s => s.category.toLowerCase().includes(category.toLowerCase()));
        }
        if (is_live_open !== undefined) {
          stores = stores.filter(s => s.is_live_open === Boolean(is_live_open));
        }
        if (city) {
          stores = stores.filter(s => (s.city || '').toLowerCase() === city.toLowerCase());
        }

        if (includeProducts) {
          const ProductModel = require('./Product');
          for (const s of stores) {
            s.products = await ProductModel.listByStore(s.id);
          }
        }
        return stores;
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] list stores notice:', err.message);
    }

    // 2. Fallback to local / Firestore
    let query = db.collection(COLLECTION);
    if (category && category !== 'All') query = query.where('category', '==', category);
    if (is_live_open !== undefined) query = query.where('is_live_open', '==', Boolean(is_live_open));
    if (city) query = query.where('city', '==', city);

    const snap = await query.limit(limit).get();
    const stores = snap.docs.map(d => d.data());

    if (includeProducts) {
      const ProductModel = require('./Product');
      for (const s of stores) {
        s.products = await ProductModel.listByStore(s.id);
      }
    }
    return stores;
  }

  static async findNearby({ lat, lng, radiusKm = 5, category } = {}) {
    const all = await this.list({ category });
    if (!lat || !lng) return all;

    const toRad = x => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    return all
      .map(store => {
        const dLat = toRad(store.latitude - lat);
        const dLon = toRad(store.longitude - lng);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat)) * Math.cos(toRad(store.latitude)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = Math.round(R * c * 10) / 10;
        return { ...store, distance_km: distanceKm };
      })
      .filter(s => s.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km);
  }
}

module.exports = StoreModel;
