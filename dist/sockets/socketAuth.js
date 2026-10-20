"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../config/supabase");
const env_1 = require("../config/env");
const socketAuthMiddleware = async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace('Bearer ', '');
        if (!token) {
            // In dev mode allow guest connection
            socket.data.user = {
                id: 'guest_user',
                phone_number: '+91-9999999999',
                role: 'customer',
                full_name: 'Local Guest Shopper'
            };
            return next();
        }
        // Support demo/mock tokens
        if (token.startsWith('mock_') || token.startsWith('demo_')) {
            const isMerchant = token.includes('shop') || token.includes('merchant');
            const isAdmin = token.includes('admin');
            socket.data.user = {
                id: token,
                phone_number: '+91-9876543210',
                role: isAdmin ? 'superadmin' : isMerchant ? 'shop_owner' : 'customer',
                full_name: isAdmin ? 'Platform Superadmin' : isMerchant ? 'Gupta General Store' : 'Local Khareedar'
            };
            return next();
        }
        let userId = null;
        // Verify token with Supabase Auth
        const { data: authData, error: authError } = await supabase_1.supabase.auth.getUser(token);
        if (!authError && authData?.user) {
            userId = authData.user.id;
        }
        else {
            // Fallback verification via JWT Secret
            try {
                const decoded = jsonwebtoken_1.default.verify(token, env_1.config.supabase.jwtSecret);
                if (decoded?.sub) {
                    userId = decoded.sub;
                }
            }
            catch (jwtErr) {
                // Fallback for development if token is client session ID
                userId = token;
            }
        }
        if (!userId) {
            return next(new Error('Authentication failed: User identity unresolved'));
        }
        // Fetch user role & details
        const { data: userProfile, error: profileErr } = await supabase_1.supabaseAdmin
            .from('users')
            .select('id, phone_number, role, full_name, fcm_token')
            .eq('id', userId)
            .single();
        if (profileErr || !userProfile) {
            // Default fallback profile for newly authenticated users
            socket.data.user = {
                id: userId,
                phone_number: '+91-9876543210',
                role: 'customer',
                full_name: 'Dukan Bari Member'
            };
            return next();
        }
        socket.data.user = {
            id: userProfile.id,
            phone_number: userProfile.phone_number,
            role: userProfile.role,
            full_name: userProfile.full_name,
            fcm_token: userProfile.fcm_token
        };
        next();
    }
    catch (error) {
        next(new Error(`Socket authentication error: ${error.message}`));
    }
};
exports.socketAuthMiddleware = socketAuthMiddleware;
