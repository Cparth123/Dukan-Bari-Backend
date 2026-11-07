const { db } = require('../config/firebase');
const { executeDataConnect, toUUID } = require('../config/dataconnect');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'products';

class ProductModel {
  static sanitize(data) {
    const price = parseFloat(data.price) || 0;
    const offerPrice = data.offer_price !== undefined && data.offer_price !== null && data.offer_price !== ''
      ? parseFloat(data.offer_price)
      : price;
    const inStock = data.in_stock !== undefined
      ? Boolean(data.in_stock)
      : (data.is_in_stock !== undefined ? Boolean(data.is_in_stock) : true);

    return {
      id: data.id || uuidv4(),
      store_id: data.store_id || data.storeId ? String(data.store_id || data.storeId) : null,
      name: data.name || 'Unnamed Product',
      description: data.description || '',
      category: data.category || 'General',
      price: price,
      offer_price: offerPrice,
      sale_price: data.sale_price !== undefined ? parseFloat(data.sale_price) : offerPrice,
      discount_price: price > offerPrice ? (price - offerPrice) : 0,
      unit: data.unit || 'piece',
      in_stock: inStock,
      is_in_stock: inStock,
      image_url: data.image_url || data.imageUrl || null,
      video_url: data.video_url || null,
      created_at: data.created_at || data.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  static async findById(id) {
    if (!id) return null;
    const formattedId = toUUID(id);

    try {
      const q = `
        query FindProductById($id: UUID!) {
          products(where: { id: { eq: $id } }, limit: 1) {
            id
            storeId
            name
            description
            price
            salePrice
            category
            imageUrl
            inStock
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { id: formattedId });
      if (res.data?.products && res.data.products.length > 0) {
        const p = res.data.products[0];
        return {
          id: p.id,
          store_id: p.storeId,
          name: p.name,
          description: p.description,
          price: p.price,
          offer_price: p.salePrice || p.price,
          sale_price: p.salePrice || p.price,
          category: p.category,
          image_url: p.imageUrl,
          in_stock: p.inStock,
          is_in_stock: p.inStock,
          created_at: p.createdAt
        };
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] findById product notice:', err.message);
    }

    const doc = await db.collection(COLLECTION).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  static async listByStore(storeId, { inStockOnly = false } = {}) {
    if (!storeId) return [];
    const formattedStoreId = toUUID(storeId);

    try {
      const q = `
        query ListProductsByStore($storeId: UUID!) {
          products(where: { storeId: { eq: $storeId } }) {
            id
            storeId
            name
            description
            price
            salePrice
            category
            imageUrl
            inStock
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { storeId: formattedStoreId });
      if (res.data?.products) {
        let products = res.data.products.map(p => ({
          id: p.id,
          store_id: p.storeId,
          name: p.name,
          description: p.description,
          price: p.price,
          offer_price: p.salePrice || p.price,
          sale_price: p.salePrice || p.price,
          discount_price: p.price > (p.salePrice || p.price) ? (p.price - p.salePrice) : 0,
          category: p.category,
          image_url: p.imageUrl,
          in_stock: p.inStock,
          is_in_stock: p.inStock,
          created_at: p.createdAt
        }));

        if (inStockOnly) {
          products = products.filter(p => p.in_stock);
        }
        return products;
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] listByStore product notice:', err.message);
    }

    let query = db.collection(COLLECTION).where('store_id', '==', String(storeId));
    if (inStockOnly) {
      query = query.where('in_stock', '==', true);
    }
    const snap = await query.get();
    return snap.docs.map(d => d.data());
  }

  static async create(productData) {
    const product = this.sanitize(productData);
    const formattedStoreId = toUUID(product.store_id);

    try {
      const mutation = `
        mutation CreateProduct(
          $storeId: UUID!
          $name: String!
          $description: String
          $price: Float!
          $salePrice: Float
          $category: String
          $imageUrl: String
          $inStock: Boolean!
        ) {
          product_insert(data: {
            storeId: $storeId
            name: $name
            description: $description
            price: $price
            salePrice: $salePrice
            category: $category
            imageUrl: $imageUrl
            inStock: $inStock
          })
        }
      `;
      const res = await executeDataConnect(mutation, {
        storeId: formattedStoreId,
        name: product.name,
        description: product.description || '',
        price: product.price,
        salePrice: product.sale_price || product.price,
        category: product.category,
        imageUrl: product.image_url,
        inStock: product.in_stock
      });

      if (res.data?.product_insert?.id) {
        product.id = res.data.product_insert.id;
        console.log('[Firebase DataConnect] Successfully inserted Product in Cloud SQL:', product.id, product.name);
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] create product error:', err.message);
    }

    await db.collection(COLLECTION).doc(String(product.id)).set(product);
    return product;
  }

  static async update(id, updates) {
    const formattedId = toUUID(id);
    const cleanUpdates = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    delete cleanUpdates.id;

    try {
      const dataPayload = {};
      if (updates.name) dataPayload.name = updates.name;
      if (updates.description !== undefined) dataPayload.description = updates.description;
      if (updates.price !== undefined) dataPayload.price = parseFloat(updates.price);
      if (updates.sale_price !== undefined || updates.offer_price !== undefined) {
        dataPayload.salePrice = parseFloat(updates.sale_price !== undefined ? updates.sale_price : updates.offer_price);
      }
      if (updates.category) dataPayload.category = updates.category;
      if (updates.image_url || updates.imageUrl) dataPayload.imageUrl = updates.image_url || updates.imageUrl;
      if (updates.in_stock !== undefined || updates.is_in_stock !== undefined) {
        dataPayload.inStock = Boolean(updates.in_stock !== undefined ? updates.in_stock : updates.is_in_stock);
      }

      if (Object.keys(dataPayload).length > 0) {
        const mutation = `
          mutation UpdateProduct($id: UUID!, $data: Product_Data!) {
            product_update(id: $id, data: $data)
          }
        `;
        await executeDataConnect(mutation, { id: formattedId, data: dataPayload });
        console.log('[Firebase DataConnect] Successfully updated Product in Cloud SQL:', id);
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] update product error:', err.message);
    }

    await db.collection(COLLECTION).doc(String(id)).set(cleanUpdates, { merge: true });
    return this.findById(id);
  }

  static async delete(id) {
    const formattedId = toUUID(id);

    try {
      const mutation = `
        mutation DeleteProduct($id: UUID!) {
          product_delete(id: $id)
        }
      `;
      await executeDataConnect(mutation, { id: formattedId });
      console.log('[Firebase DataConnect] Successfully deleted Product from Cloud SQL:', id);
    } catch (err) {
      console.warn('[Firebase DataConnect] delete product error:', err.message);
    }

    await db.collection(COLLECTION).doc(String(id)).delete();
    return true;
  }

  static async listAll({ limit = 100 } = {}) {
    try {
      const q = `
        query ListAllProducts {
          products(limit: ${limit}) {
            id
            storeId
            name
            description
            price
            salePrice
            category
            imageUrl
            inStock
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q);
      if (Array.isArray(res.data?.products)) {
        return res.data.products.map(p => ({
          id: p.id,
          store_id: p.storeId,
          name: p.name,
          description: p.description,
          price: p.price,
          offer_price: p.salePrice || p.price,
          sale_price: p.salePrice || p.price,
          discount_price: p.price > (p.salePrice || p.price) ? (p.price - p.salePrice) : 0,
          category: p.category,
          image_url: p.imageUrl,
          in_stock: p.inStock,
          is_in_stock: p.inStock,
          created_at: p.createdAt
        }));
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] listAll products notice:', err.message);
    }
    const snap = await db.collection(COLLECTION).limit(limit).get();
    return snap.docs.map(d => d.data());
  }

  static async search(term, { limit = 50 } = {}) {
    const cleanTerm = String(term).toLowerCase().trim();
    const all = await this.listAll({ limit: 100 });
    return all.filter(p => (p.name || '').toLowerCase().includes(cleanTerm) || (p.description || '').toLowerCase().includes(cleanTerm)).slice(0, limit);
  }
}

module.exports = ProductModel;
