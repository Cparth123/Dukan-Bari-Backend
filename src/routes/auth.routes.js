const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, Store, Product, Offer, Conversation, Message, Review } = require('../models');
const { db } = require('../config/firebase');
const { generateToken, requireAuth } = require('../middleware/auth');
const { verifyGoogleToken } = require('../services/googleAuth');

// 1. Register User (Customer or Dukandar)
router.post('/register', async (req, res) => {
  try {
    const { email, phone, password, full_name, role, store_name, category, address } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    // Check existing
    if (email) {
      const existing = await User.findByEmail(email);
      if (existing) {
        return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
      }
    }
    if (phone) {
      const existingPhone = await User.findByPhone(phone);
      if (existingPhone) {
        return res.status(400).json({ success: false, error: 'An account with this phone already exists.' });
      }
    }

    // Password hash (if provided)
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const assignedRole = role === 'dukandar' ? 'dukandar' : 'customer';

    // Create user in Firebase
    const newUser = await User.create({
      email: cleanEmail,
      phone: phone || null,
      password_hash: passwordHash,
      full_name: full_name || 'Dukan Bari User',
      role: assignedRole
    });

    // If Dukandar, automatically initialize their store record
    let store = null;
    if (assignedRole === 'dukandar') {
      store = await Store.create({
        owner_id: newUser.id,
        name: store_name || `${full_name || 'Partner'}'s Dukan`,
        category: category || 'Grocery',
        address: address || '',
        phone: phone || ''
      });
    }

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        phone: newUser.phone,
        full_name: newUser.full_name,
        role: newUser.role,
        avatar_url: newUser.avatar_url
      },
      store: store ? { id: store.id, name: store.name } : null
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    return res.status(500).json({ success: false, error: 'Registration failed: ' + err.message });
  }
});

// 2. Login User
router.post('/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    const identifier = email || phone;

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Please enter your email or phone number.' });
    }

    let user = null;
    if (email) user = await User.findByEmail(email);
    if (!user && phone) user = await User.findByPhone(phone);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Account not found. Please sign up first.' });
    }

    // Check password if set
    if (user.password_hash && password) {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid password. Please try again.' });
      }
    }

    const token = generateToken(user);
    const store = user.role === 'dukandar' ? await Store.findByOwnerId(user.id) : null;

    return res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        full_name: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url
      },
      store: store ? { id: store.id, name: store.name, is_live_open: store.is_live_open } : null
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ success: false, error: 'Login failed: ' + err.message });
  }
});

// 3. Google Sign-In Verification
router.post('/google', async (req, res) => {
  try {
    const { id_token, role = 'customer' } = req.body;
    if (!id_token) {
      return res.status(400).json({ success: false, error: 'Google id_token is required' });
    }

    const googleUser = await verifyGoogleToken(id_token);
    let user = await User.findByEmail(googleUser.email);

    if (!user) {
      // First time Google user: create in Firebase
      user = await User.create({
        email: googleUser.email,
        full_name: googleUser.name,
        avatar_url: googleUser.picture,
        role: role === 'dukandar' ? 'dukandar' : 'customer'
      });

      if (user.role === 'dukandar') {
        await Store.create({
          owner_id: user.id,
          name: `${googleUser.name}'s Dukan`,
          category: 'General'
        });
      }
    }

    const token = generateToken(user);
    const store = user.role === 'dukandar' ? await Store.findByOwnerId(user.id) : null;

    return res.json({
      success: true,
      message: 'Google authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        full_name: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url
      },
      store: store ? { id: store.id, name: store.name } : null
    });
  } catch (err) {
    console.error('[Auth] Google OAuth error:', err.message);
    return res.status(401).json({ success: false, error: 'Google login failed: ' + err.message });
  }
});

// 4. Get Current Profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let store = null;
    if (user.role === 'dukandar') {
      store = await Store.findByOwnerId(user.id);
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        full_name: user.full_name,
        role: user.role,
        address: user.address || '',
        latitude: user.latitude,
        longitude: user.longitude,
        avatar_url: user.avatar_url
      },
      store: store ? { id: store.id, name: store.name, is_live_open: store.is_live_open } : null
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Update Profile (Name, Phone, Address, Location GPS)
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, phone, address, latitude, longitude, avatar_url, store_name, category } = req.body;

    const updates = {};
    if (full_name !== undefined) updates.full_name = String(full_name).trim();
    if (phone !== undefined) {
      updates.phone = String(phone).trim();
      updates.phone_number = String(phone).trim();
    }
    if (address !== undefined) updates.address = String(address).trim();
    if (latitude !== undefined) updates.latitude = Number(latitude);
    if (longitude !== undefined) updates.longitude = Number(longitude);
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const updatedUser = await User.update(userId, updates);

    // If Dukandar, also update store record if applicable
    let updatedStore = null;
    if (req.user.role === 'dukandar') {
      const store = await Store.findByOwnerId(userId);
      if (store) {
        const storeUpdates = {};
        if (store_name) storeUpdates.name = String(store_name).trim();
        if (category) storeUpdates.category = String(category).trim();
        if (address !== undefined) storeUpdates.address = String(address).trim();
        if (phone !== undefined) storeUpdates.phone = String(phone).trim();
        if (latitude !== undefined) storeUpdates.latitude = Number(latitude);
        if (longitude !== undefined) storeUpdates.longitude = Number(longitude);

        if (Object.keys(storeUpdates).length > 0) {
          updatedStore = await Store.update(store.id, storeUpdates);
        } else {
          updatedStore = store;
        }
      }
    }

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        phone: updatedUser.phone,
        full_name: updatedUser.full_name,
        role: updatedUser.role,
        address: updatedUser.address || '',
        latitude: updatedUser.latitude,
        longitude: updatedUser.longitude,
        avatar_url: updatedUser.avatar_url
      },
      store: updatedStore ? { id: updatedStore.id, name: updatedStore.name, is_live_open: updatedStore.is_live_open } : null
    });
  } catch (err) {
    console.error('[Auth] Profile update error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update profile: ' + err.message });
  }
});

// 6. Delete Account Permanently & Cascade All Data
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[Auth] Initiating permanent cascading deletion for user: ${userId} (${req.user.role})`);

    // 1. If Dukandar, delete associated store and all store child records
    const store = await Store.findByOwnerId(userId);
    if (store) {
      const storeId = store.id;
      console.log(`[Auth] Deleting associated store: ${storeId}`);

      // 1a. Delete all products belonging to store
      try {
        const prodSnap = await db.collection('products').where('store_id', '==', storeId).get();
        for (const doc of prodSnap.docs) {
          await Product.delete(doc.id).catch(() => {});
        }
      } catch (e) {
        console.warn('[Auth] Error deleting store products:', e.message);
      }

      // 1b. Delete all offers belonging to store
      try {
        const offerSnap = await db.collection('offers').where('store_id', '==', storeId).get();
        for (const doc of offerSnap.docs) {
          await Offer.delete(doc.id).catch(() => {});
        }
      } catch (e) {
        console.warn('[Auth] Error deleting store offers:', e.message);
      }

      // 1c. Delete all reviews for this store
      try {
        const revSnap = await db.collection('store_reviews').where('store_id', '==', storeId).get();
        for (const doc of revSnap.docs) {
          await db.collection('store_reviews').doc(doc.id).delete().catch(() => {});
        }
      } catch (e) {
        console.warn('[Auth] Error deleting store reviews:', e.message);
      }

      // 1d. Delete all conversations & messages for this store
      try {
        const convSnap = await db.collection('conversations').where('store_id', '==', storeId).get();
        for (const cDoc of convSnap.docs) {
          const msgSnap = await db.collection('messages').where('conversation_id', '==', cDoc.id).get();
          for (const mDoc of msgSnap.docs) {
            await db.collection('messages').doc(mDoc.id).delete().catch(() => {});
          }
          await db.collection('conversations').doc(cDoc.id).delete().catch(() => {});
        }
      } catch (e) {
        console.warn('[Auth] Error deleting store conversations:', e.message);
      }

      // 1e. Delete store record itself
      await Store.delete(storeId).catch(() => {});
    }

    // 2. Delete all customer conversations & messages
    try {
      const custConvSnap = await db.collection('conversations').where('customer_id', '==', userId).get();
      for (const cDoc of custConvSnap.docs) {
        const msgSnap = await db.collection('messages').where('conversation_id', '==', cDoc.id).get();
        for (const mDoc of msgSnap.docs) {
          await db.collection('messages').doc(mDoc.id).delete().catch(() => {});
        }
        await db.collection('conversations').doc(cDoc.id).delete().catch(() => {});
      }
    } catch (e) {
      console.warn('[Auth] Error deleting customer conversations:', e.message);
    }

    // 3. Delete any messages sent by user
    try {
      const msgSnap = await db.collection('messages').where('sender_id', '==', userId).get();
      for (const mDoc of msgSnap.docs) {
        await db.collection('messages').doc(mDoc.id).delete().catch(() => {});
      }
    } catch (e) {
      console.warn('[Auth] Error deleting user messages:', e.message);
    }

    // 4. Delete all customer reviews written by user
    try {
      const userRevSnap = await db.collection('store_reviews').where('user_id', '==', userId).get();
      for (const doc of userRevSnap.docs) {
        await db.collection('store_reviews').doc(doc.id).delete().catch(() => {});
      }
    } catch (e) {
      console.warn('[Auth] Error deleting user reviews:', e.message);
    }

    // 5. Delete all reverse enquiries & bids created by user
    try {
      const enqSnap = await db.collection('enquiries').where('customer_id', '==', userId).get();
      for (const doc of enqSnap.docs) {
        await db.collection('enquiries').doc(doc.id).delete().catch(() => {});
      }
      const bidsSnap = await db.collection('enquiry_bids').where('dukandar_id', '==', userId).get();
      for (const doc of bidsSnap.docs) {
        await db.collection('enquiry_bids').doc(doc.id).delete().catch(() => {});
      }
    } catch (e) {
      console.warn('[Auth] Error deleting user enquiries:', e.message);
    }

    // 6. Finally, delete the User record
    await User.delete(userId);

    console.log(`[Auth] User ${userId} and all related records deleted permanently.`);
    return res.json({
      success: true,
      message: 'User account and all relative table data permanently deleted.'
    });
  } catch (err) {
    console.error('[Auth] Error during cascading account deletion:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete account: ' + err.message });
  }
});

// 7. Developer & Admin Database Reset / Cache Flush Endpoint
router.all('/reset-database', async (req, res) => {
  try {
    const { clearAllCache } = require('../config/firebase');
    const cacheResult = clearAllCache ? clearAllCache() : { purgedCollections: 0 };

    console.log('[Dev/Admin] reset-database invoked. In-memory cache cleared.');
    return res.json({
      success: true,
      message: 'Database memory cache wiped clean. All stale stores, users, and sessions have been reset.',
      details: cacheResult
    });
  } catch (err) {
    console.error('[Dev/Admin] Error resetting database cache:', err.message);
    return res.status(500).json({ success: false, error: 'Reset failed: ' + err.message });
  }
});

module.exports = router;

