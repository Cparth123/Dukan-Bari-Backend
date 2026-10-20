import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

/**
 * POST /api/enquiries
 * Customer broadcasts an item reverse-enquiry to nearby stores
 */
router.post(
  '/',
  authenticateUser,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const {
        title,
        description,
        category,
        media_url,
        latitude,
        longitude,
        radius_km = 3.0
      } = req.body;

      if (!title || !description || latitude == null || longitude == null) {
        res.status(400).json({
          success: false,
          message: 'Missing required enquiry parameters (title, description, lat/lng)'
        });
        return;
      }

      const locationPoint = `POINT(${longitude} ${latitude})`;

      const { data: enquiry, error } = await supabaseAdmin
        .from('enquiries')
        .insert({
          customer_id: user.id,
          title,
          description,
          category,
          media_url,
          location: locationPoint,
          radius_km,
          status: 'open'
        })
        .select()
        .single();

      if (error || !enquiry) {
        res.status(500).json({ success: false, message: 'Failed to create enquiry', error: error?.message });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Reverse enquiry published to nearby merchants successfully',
        data: enquiry
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }
);

/**
 * GET /api/enquiries/merchant-inbox/:storeId
 * Merchant Reverse Enquiry Desk: List nearby consumer queries
 */
router.get(
  '/merchant-inbox/:storeId',
  authenticateUser,
  requireRole(['shop_owner', 'superadmin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { storeId } = req.params;

      // Verify store ownership
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('owner_id')
        .eq('id', storeId)
        .single();

      if (!store || (store.owner_id !== req.user!.id && req.user!.role !== 'superadmin')) {
        res.status(403).json({ success: false, message: 'Unauthorized access to store inbox' });
        return;
      }

      const { data: enquiries, error } = await supabaseAdmin.rpc('get_nearby_enquiries_for_store', {
        p_store_id: storeId
      });

      if (error) {
        res.status(500).json({ success: false, error: error.message });
        return;
      }

      res.status(200).json({
        success: true,
        count: enquiries ? enquiries.length : 0,
        data: enquiries || []
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }
);

/**
 * POST /api/enquiries/:enquiryId/respond
 * 1-Tap Merchant Reply with availability and price quote
 */
router.post(
  '/:enquiryId/respond',
  authenticateUser,
  requireRole(['shop_owner', 'superadmin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { enquiryId } = req.params;
      const { store_id, is_available = true, price_quote, note, media_url } = req.body;

      if (!store_id) {
        res.status(400).json({ success: false, message: 'store_id is required' });
        return;
      }

      // Check ownership
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('owner_id, store_name')
        .eq('id', store_id)
        .single();

      if (!store || (store.owner_id !== req.user!.id && req.user!.role !== 'superadmin')) {
        res.status(403).json({ success: false, message: 'Unauthorized for this store' });
        return;
      }

      const { data: response, error } = await supabaseAdmin
        .from('enquiry_responses')
        .upsert(
          {
            enquiry_id: enquiryId,
            store_id,
            is_available,
            price_quote,
            note,
            media_url
          },
          { onConflict: 'enquiry_id,store_id' }
        )
        .select()
        .single();

      if (error) {
        res.status(500).json({ success: false, error: error.message });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Response submitted to customer enquiry',
        data: response
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }
);

/**
 * GET /api/enquiries/my
 * Customer views all their submitted enquiries and incoming store quotes
 */
router.get('/my', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: enquiries, error } = await supabaseAdmin
      .from('enquiries')
      .select('*, enquiry_responses(*, stores(id, store_name, phone_contact, banner_url))')
      .eq('customer_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.status(200).json({
      success: true,
      data: enquiries || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
