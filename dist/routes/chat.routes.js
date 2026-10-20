"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../config/supabase");
const router = (0, express_1.Router)();
/**
 * GET /api/chat/conversations
 * Fetch all conversations for the authenticated user
 */
router.get('/conversations', auth_1.authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        let query = supabase_1.supabaseAdmin
            .from('conversations')
            .select('*, stores(id, store_name, category, banner_url, owner_id), customer:users!conversations_customer_id_fkey(id, full_name, phone_number)')
            .order('last_message_at', { ascending: false });
        if (user.role === 'customer') {
            query = query.eq('customer_id', user.id);
        }
        else if (user.role === 'shop_owner') {
            // Find all stores owned by this merchant
            const { data: stores } = await supabase_1.supabaseAdmin
                .from('stores')
                .select('id')
                .eq('owner_id', user.id);
            const storeIds = (stores || []).map((s) => s.id);
            query = query.in('store_id', storeIds);
        } // superadmin can see all
        const { data: conversations, error } = await query;
        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }
        res.status(200).json({
            success: true,
            data: conversations || []
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/chat/conversations
 * Open or retrieve an existing conversation with a store
 */
router.post('/conversations', auth_1.authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const { store_id } = req.body;
        if (!store_id) {
            res.status(400).json({ success: false, message: 'store_id is required' });
            return;
        }
        // Check if conversation already exists
        const { data: existingConv } = await supabase_1.supabaseAdmin
            .from('conversations')
            .select('*, stores(id, store_name, category, banner_url, owner_id)')
            .eq('store_id', store_id)
            .eq('customer_id', user.id)
            .maybeSingle();
        if (existingConv) {
            res.status(200).json({ success: true, isNew: false, data: existingConv });
            return;
        }
        // Create new conversation
        const { data: newConv, error } = await supabase_1.supabaseAdmin
            .from('conversations')
            .insert({
            store_id,
            customer_id: user.id
        })
            .select('*, stores(id, store_name, category, banner_url, owner_id)')
            .single();
        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }
        res.status(201).json({ success: true, isNew: true, data: newConv });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/chat/conversations/:id/messages
 * Retrieve messages for a conversation
 */
router.get('/conversations/:id/messages', auth_1.authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit || '50', 10);
        const before = req.query.before;
        let query = supabase_1.supabaseAdmin
            .from('messages')
            .select('*, sender:users(id, full_name, role)')
            .eq('conversation_id', id)
            .order('created_at', { ascending: true })
            .limit(limit);
        if (before) {
            query = query.lt('created_at', before);
        }
        const { data: messages, error } = await query;
        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }
        res.status(200).json({
            success: true,
            count: messages ? messages.length : 0,
            data: messages || []
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
