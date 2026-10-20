"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rbac_1 = require("../middleware/rbac");
const supabase_1 = require("../config/supabase");
const router = (0, express_1.Router)();
/**
 * GET /api/stores/nearby
 * Hyperlocal Store Discovery with live status badges and distance
 */
router.get('/nearby', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const radiusMeters = parseFloat(req.query.radius_meters || '5000');
        const category = req.query.category || null;
        const city = req.query.city || null;
        const state = req.query.state || null;
        const pincode = req.query.pincode || null;
        const openOnly = req.query.open_only === 'true';
        if (isNaN(lat) || isNaN(lng)) {
            res.status(400).json({
                success: false,
                message: 'Valid "lat" and "lng" query parameters are required'
            });
            return;
        }
        // Call PostgreSQL stored procedure
        let { data: stores, error } = await supabase_1.supabaseAdmin.rpc('get_nearby_stores_with_status', {
            user_lat: lat,
            user_lng: lng,
            radius_meters: radiusMeters,
            filter_category: category,
            open_only: openOnly
        });
        if (error) {
            console.warn('PostGIS RPC fallback, querying stores table directly:', error.message);
            // Fallback query if RPC isn't initialized yet
            let query = supabase_1.supabaseAdmin.from('stores').select('*');
            if (city)
                query = query.ilike('city', `%${city}%`);
            if (pincode)
                query = query.eq('pincode', pincode);
            const fallbackResult = await query;
            stores = fallbackResult.data;
        }
        // Apply city / state / pincode in-memory filters if specified
        if (stores && Array.isArray(stores)) {
            if (city) {
                stores = stores.filter((s) => s.city?.toLowerCase().includes(city.toLowerCase()));
            }
            if (pincode) {
                stores = stores.filter((s) => s.pincode === pincode);
            }
        }
        // Enrich stores with mock product showcase thumbnails for demo if not yet populated
        const enrichedStores = (stores || []).map((store) => {
            const isKirana = store.category?.includes('Grocery') || store.category?.includes('Kirana');
            const isPharmacy = store.category?.includes('Pharmacy') || store.category?.includes('Medical');
            const isAdvocate = store.category?.includes('Advocate') || store.category?.includes('Legal');
            const isAdvisor = store.category?.includes('Tax') || store.category?.includes('CA') || store.category?.includes('Advisor');
            const isFood = store.category?.includes('Food') || store.category?.includes('Restaurant') || store.category?.includes('Dhaba');
            const isPanipuri = store.category?.includes('Panipuri') || store.category?.includes('Chaat');
            const isPaan = store.category?.includes('Paan') || store.category?.includes('Pan Masala');
            const isMochi = store.category?.includes('Mochi') || store.category?.includes('Shoe');
            const isSaloon = store.category?.includes('Saloon') || store.category?.includes('Grooming');
            const isChai = store.category?.includes('Chai') || store.category?.includes('Tea');
            const isPuncture = store.category?.includes('Puncture') || store.category?.includes('Cycle');
            const defaultProducts = isPanipuri ? [
                { name: 'Special Golgappa Pani Puri (6 Pcs)', price: 30, image_url: '/dhaba-thali.jpg' },
                { name: 'Bombay Special Sev Puri (6 Pcs)', price: 40, image_url: '/dhaba-thali.jpg' },
                { name: 'Dahi Papdi Chaat', price: 50, image_url: '/dhaba-thali.jpg' }
            ] : isPaan ? [
                { name: 'Banarasi Meetha Paan', price: 25, image_url: '/grocery-product.jpg' },
                { name: 'Calcutta Sada Paan', price: 20, image_url: '/grocery-product.jpg' },
                { name: 'Chilled Jeera Masala Soda', price: 15, image_url: '/grocery-product.jpg' }
            ] : isMochi ? [
                { name: 'Shoe Sole Double Stitching', price: 50, image_url: '/hero-dukandar.jpg' },
                { name: 'Leather Shoe Polish & Buffing', price: 30, image_url: '/hero-dukandar.jpg' },
                { name: 'Belt Hole Punch & Repair', price: 20, image_url: '/hero-dukandar.jpg' }
            ] : isSaloon ? [
                { name: "Gent's Stylish Haircut & Wash", price: 100, image_url: '/advocate-office.jpg' },
                { name: 'Smooth Shave & Designer Beard Trim', price: 60, image_url: '/advocate-office.jpg' },
                { name: 'Navratna Oil Head Massage', price: 80, image_url: '/advocate-office.jpg' }
            ] : isChai ? [
                { name: 'Special Kadak Adrak Elaichi Chai', price: 12, image_url: '/punjab-dhaba.jpg' },
                { name: 'Amul Butter Maskabun', price: 35, image_url: '/punjab-dhaba.jpg' },
                { name: 'Crispy Samosa with Chutney (2 Pcs)', price: 30, image_url: '/dhaba-thali.jpg' }
            ] : isPuncture ? [
                { name: 'Tubeless Tyre Puncture Fix', price: 60, image_url: '/hero-dukandar.jpg' },
                { name: 'Air Pressure & Valve Check', price: 10, image_url: '/hero-dukandar.jpg' },
                { name: 'Heavy Duty Tube Replacement', price: 140, image_url: '/hero-dukandar.jpg' }
            ] : isKirana ? [
                { name: 'Ashirwad Chakki Atta 10kg', price: 420, image_url: '/grocery-product.jpg' },
                { name: 'Sunflower Oil 5L', price: 650, image_url: '/grocery-product.jpg' },
                { name: 'Basmati Rice 5kg', price: 380, image_url: '/grocery-product.jpg' }
            ] : isPharmacy ? [
                { name: 'Crocin 650mg (15 Tab)', price: 32, image_url: '/apollo-pharmacy.jpg' },
                { name: 'Dettol Antiseptic 250ml', price: 85, image_url: '/apollo-pharmacy.jpg' },
                { name: 'Digital Blood Pressure Monitor', price: 1850, image_url: '/apollo-pharmacy.jpg' }
            ] : isAdvocate ? [
                { name: 'Legal Consultation & Review (30 Mins)', price: 500, image_url: '/advocate-office.jpg' },
                { name: 'Property Registry Title Check', price: 1500, image_url: '/advocate-office.jpg' },
                { name: 'Affidavit & Notary Agreement', price: 350, image_url: '/advocate-office.jpg' }
            ] : isAdvisor ? [
                { name: 'Income Tax Return (ITR) Filing', price: 799, image_url: '/ca-advisor.jpg' },
                { name: 'GST Monthly Return (GSTR 1 & 3B)', price: 1199, image_url: '/ca-advisor.jpg' },
                { name: 'Pvt Ltd Company Incorporation', price: 4999, image_url: '/ca-advisor.jpg' }
            ] : isFood ? [
                { name: 'Special Dal Makhani Handi', price: 180, image_url: '/punjab-dhaba.jpg' },
                { name: 'Paneer Butter Masala', price: 220, image_url: '/punjab-dhaba.jpg' },
                { name: 'Executive Punjabi Thali', price: 199, image_url: '/punjab-dhaba.jpg' }
            ] : [
                { name: 'Daily Store Counter Item', price: 120 }
            ];
            const defaultBanner = isKirana ? '/gupta-store.jpg'
                : isPharmacy ? '/apollo-pharmacy.jpg'
                    : isAdvocate ? '/advocate-office.jpg'
                        : isAdvisor ? '/ca-advisor.jpg'
                            : (isFood || isPanipuri || isChai) ? '/punjab-dhaba.jpg'
                                : '/hero-dukandar.jpg';
            const offeringType = store.business_offering_type ||
                (isAdvocate || isAdvisor || isMochi || isSaloon || isPuncture ? 'service_providing' : (isFood || isPanipuri || isChai) ? 'both' : 'product_selling');
            return {
                ...store,
                business_offering_type: offeringType,
                banner_url: store.banner_url || defaultBanner,
                showcase_products: store.showcase_products || defaultProducts,
                rating: store.rating || (isKirana ? 4.8 : isAdvocate ? 4.9 : isAdvisor ? 4.9 : isFood || isPanipuri || isMochi ? 4.9 : 4.8)
            };
        });
        res.status(200).json({
            success: true,
            count: enrichedStores.length,
            radiusMeters,
            filters: { city, state, pincode, category },
            data: enrichedStores
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/stores/live-map
 * Returns shop coordinates, live status, and relative angles for real-time map radar
 */
router.get('/live-map', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat) || 28.6139;
        const lng = parseFloat(req.query.lng) || 77.2090;
        const radiusKm = parseFloat(req.query.radius_km) || 5.0;
        const { data: stores, error } = await supabase_1.supabaseAdmin
            .from('stores')
            .select('id, store_name, category, address_line, city, is_live_open, banner_url, phone_contact, whatsapp_number')
            .eq('verification_status', 'verified');
        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }
        res.status(200).json({
            success: true,
            userLocation: { latitude: lat, longitude: lng },
            radiusKm,
            stores: stores || []
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/stores/:id
 * Get single store details with active announcements
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: store, error } = await supabase_1.supabaseAdmin
            .from('stores')
            .select('*, announcements_and_offers(*)')
            .eq('id', id)
            .single();
        if (error || !store) {
            res.status(404).json({ success: false, message: 'Store not found' });
            return;
        }
        res.status(200).json({ success: true, data: store });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/stores
 * Register a new store (Merchant / Superadmin)
 */
router.post('/', auth_1.authenticateUser, (0, rbac_1.requireRole)(['shop_owner', 'superadmin']), async (req, res) => {
    try {
        const user = req.user;
        const { store_name, category, business_offering_type = 'product_selling', address_line, city, pincode, latitude, longitude, standard_open_time = '09:00:00', standard_close_time = '21:00:00', banner_url, phone_contact, whatsapp_number } = req.body;
        if (!store_name || !category || !address_line || !city || !pincode || latitude == null || longitude == null) {
            res.status(400).json({
                success: false,
                message: 'Missing required store profile fields (store_name, category, address, lat/lng)'
            });
            return;
        }
        // Format PostGIS Point: POINT(longitude latitude)
        const locationPoint = `POINT(${longitude} ${latitude})`;
        const { data: newStore, error } = await supabase_1.supabaseAdmin
            .from('stores')
            .insert({
            owner_id: user.id,
            store_name,
            category,
            business_offering_type,
            address_line,
            city,
            pincode,
            location: locationPoint,
            is_live_open: true,
            standard_open_time,
            standard_close_time,
            verification_status: user.role === 'superadmin' ? 'verified' : 'pending',
            banner_url,
            phone_contact: phone_contact || user.phone_number,
            whatsapp_number: whatsapp_number || user.phone_number
        })
            .select()
            .single();
        if (error) {
            res.status(500).json({ success: false, message: 'Failed to create store', error: error.message });
            return;
        }
        res.status(201).json({
            success: true,
            message: 'Store created successfully. Pending KYC verification.',
            data: newStore
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * PATCH /api/stores/:id/status
 * One-tap toggle for Live Store Status (OPEN / CLOSED)
 */
router.patch('/:id/status', auth_1.authenticateUser, (0, rbac_1.requireRole)(['shop_owner', 'superadmin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_live_open } = req.body;
        if (typeof is_live_open !== 'boolean') {
            res.status(400).json({ success: false, message: 'is_live_open must be a boolean' });
            return;
        }
        const { data: store, error: fetchErr } = await supabase_1.supabaseAdmin
            .from('stores')
            .select('owner_id')
            .eq('id', id)
            .single();
        if (fetchErr || !store) {
            res.status(404).json({ success: false, message: 'Store not found' });
            return;
        }
        if (store.owner_id !== req.user.id && req.user.role !== 'superadmin') {
            res.status(403).json({ success: false, message: 'Unauthorized to modify this store' });
            return;
        }
        const { data: updated, error: updateErr } = await supabase_1.supabaseAdmin
            .from('stores')
            .update({ is_live_open })
            .eq('id', id)
            .select()
            .single();
        if (updateErr) {
            res.status(500).json({ success: false, error: updateErr.message });
            return;
        }
        res.status(200).json({
            success: true,
            message: `Store status updated to ${is_live_open ? 'OPEN' : 'CLOSED'}`,
            data: updated
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * PATCH /api/stores/:id/verify
 * Superadmin Verification & Onboarding Action
 */
router.patch('/:id/verify', auth_1.authenticateUser, (0, rbac_1.requireRole)(['superadmin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'verified' | 'rejected' | 'suspended'
        if (!['verified', 'rejected', 'suspended'].includes(status)) {
            res.status(400).json({
                success: false,
                message: 'Invalid status. Must be verified, rejected, or suspended'
            });
            return;
        }
        const { data: updated, error } = await supabase_1.supabaseAdmin
            .from('stores')
            .update({ verification_status: status })
            .eq('id', id)
            .select()
            .single();
        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }
        res.status(200).json({
            success: true,
            message: `Store verification status updated to ${status}`,
            data: updated
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
