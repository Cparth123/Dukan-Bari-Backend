import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { supabaseAdmin } from '../config/supabase';
import { NotificationService } from '../services/notification.service';

const router = Router();

/**
 * POST /api/announcements
 * Merchant posts a limited-time deal or flash alert
 * Automatically runs PostGIS query to notify devices within radius_km
 */
router.post(
  '/',
  authenticateUser,
  requireRole(['shop_owner', 'superadmin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        store_id,
        title,
        description,
        discount_tag,
        banner_image,
        valid_until,
        radius_km = 3.0
      } = req.body;

      if (!store_id || !title || !description || !valid_until) {
        res.status(400).json({
          success: false,
          message: 'Missing required announcement fields (store_id, title, description, valid_until)'
        });
        return;
      }

      // Check merchant ownership
      const { data: store, error: storeErr } = await supabaseAdmin
        .from('stores')
        .select('id, owner_id, store_name, verification_status')
        .eq('id', store_id)
        .single();

      if (storeErr || !store) {
        res.status(404).json({ success: false, message: 'Store not found' });
        return;
      }

      if (store.owner_id !== req.user!.id && req.user!.role !== 'superadmin') {
        res.status(403).json({ success: false, message: 'Unauthorized to post announcements for this store' });
        return;
      }

      // Save announcement in Supabase
      const { data: announcement, error: insertErr } = await supabaseAdmin
        .from('announcements_and_offers')
        .insert({
          store_id,
          title,
          description,
          discount_tag,
          banner_image,
          valid_until,
          radius_km,
          is_active: true
        })
        .select()
        .single();

      if (insertErr || !announcement) {
        res.status(500).json({ success: false, message: 'Failed to create announcement', error: insertErr?.message });
        return;
      }

      // Asynchronously trigger geofenced push notification worker
      NotificationService.broadcastOfferToNearbyUsers(
        store.id,
        store.store_name,
        title,
        discount_tag,
        radius_km
      ).catch((err) => console.error('Background push broadcast failed:', err));

      res.status(201).json({
        success: true,
        message: 'Announcement posted and push alert queued for nearby residents!',
        data: announcement
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }
);

/**
 * GET /api/announcements/feed
 * Proximity-based feed of active announcements
 */
router.get('/feed', async (req: Request, res: Response): Promise<void> => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    let query = supabaseAdmin
      .from('announcements_and_offers')
      .select('*, stores(id, store_name, category, address_line, banner_url, is_live_open)')
      .eq('is_active', true)
      .gt('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(30);

    const { data: feed, error } = await query;

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.status(200).json({
      success: true,
      count: feed ? feed.length : 0,
      data: feed || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
