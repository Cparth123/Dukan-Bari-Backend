const { db } = require('../config/firebase');
const { executeDataConnect, toUUID } = require('../config/dataconnect');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'store_reviews';

class ReviewModel {
  static sanitize(data) {
    return {
      id: data.id || uuidv4(),
      store_id: String(data.store_id || data.storeId),
      user_id: String(data.user_id || data.userId || data.customer_id),
      user_name: data.user_name || data.userName || 'Verified Customer',
      rating: Math.max(1, Math.min(5, parseInt(data.rating, 10) || 5)),
      comment: data.comment || '',
      created_at: data.created_at || data.createdAt || new Date().toISOString()
    };
  }

  static async findById(id) {
    if (!id) return null;
    const doc = await db.collection(COLLECTION).doc(String(id)).get();
    return doc.exists ? doc.data() : null;
  }

  static async listByStore(storeId, { limit = 50 } = {}) {
    if (!storeId) return [];
    const formattedStoreId = toUUID(storeId);

    // 1. Try Firebase Data Connect
    try {
      const q = `
        query ListStoreReviews($storeId: UUID!) {
          storeReviews(where: { storeId: { eq: $storeId } }) {
            id
            storeId
            userId
            userName
            rating
            comment
            createdAt
          }
        }
      `;
      const res = await executeDataConnect(q, { storeId: formattedStoreId });
      if (res.data?.storeReviews) {
        return res.data.storeReviews.map(r => ({
          id: r.id,
          store_id: r.storeId,
          user_id: r.userId,
          user_name: r.userName,
          rating: r.rating,
          comment: r.comment,
          created_at: r.createdAt
        }));
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] listByStore reviews notice:', err.message);
    }

    // 2. Fallback
    const snap = await db.collection(COLLECTION)
      .where('store_id', '==', String(storeId))
      .limit(limit)
      .get();
    return snap.docs.map(d => d.data());
  }

  static async create(reviewData) {
    const review = this.sanitize(reviewData);
    const formattedStoreId = toUUID(review.store_id);
    const formattedUserId = toUUID(review.user_id);

    // 1. Commit to Firebase Data Connect (Cloud SQL)
    try {
      const mutation = `
        mutation CreateReview(
          $storeId: UUID!
          $userId: UUID!
          $userName: String!
          $rating: Int!
          $comment: String
        ) {
          storeReview_insert(data: {
            storeId: $storeId
            userId: $userId
            userName: $userName
            rating: $rating
            comment: $comment
          })
        }
      `;
      const res = await executeDataConnect(mutation, {
        storeId: formattedStoreId,
        userId: formattedUserId,
        userName: review.user_name,
        rating: review.rating,
        comment: review.comment
      });
      if (res.data?.storeReview_insert?.id) {
        review.id = res.data.storeReview_insert.id;
        console.log('[Firebase DataConnect] Successfully inserted StoreReview in Cloud SQL:', review.id);
      }
    } catch (err) {
      console.warn('[Firebase DataConnect] create review error:', err.message);
    }

    // 2. Local fallback / cache
    await db.collection(COLLECTION).doc(String(review.id)).set(review);

    // Update store average rating
    try {
      const StoreModel = require('./Store');
      const storeReviews = await this.listByStore(review.store_id);
      if (storeReviews.length > 0) {
        const total = storeReviews.reduce((sum, r) => sum + r.rating, 0);
        const avg = Math.round((total / storeReviews.length) * 10) / 10;
        await StoreModel.update(review.store_id, {
          rating: avg,
          review_count: storeReviews.length
        });
      }
    } catch (e) {
      console.warn('[ReviewModel] Could not update store average rating:', e.message);
    }

    return review;
  }
}

module.exports = ReviewModel;
