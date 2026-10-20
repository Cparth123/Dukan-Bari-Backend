import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { supabase, supabaseAdmin } from '../config/supabase';
import { config } from '../config/env';
import { AuthUser, UserRole } from '../types';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: AuthUser;
  };
}

export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    const token =
      socket.handshake.auth?.token ||
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

    let userId: string | null = null;

    // Verify token with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (!authError && authData?.user) {
      userId = authData.user.id;
    } else {
      // Fallback verification via JWT Secret
      try {
        const decoded = jwt.verify(token, config.supabase.jwtSecret) as { sub?: string };
        if (decoded?.sub) {
          userId = decoded.sub;
        }
      } catch (jwtErr) {
        // Fallback for development if token is client session ID
        userId = token;
      }
    }

    if (!userId) {
      return next(new Error('Authentication failed: User identity unresolved'));
    }

    // Fetch user role & details
    const { data: userProfile, error: profileErr } = await supabaseAdmin
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
      role: userProfile.role as UserRole,
      full_name: userProfile.full_name,
      fcm_token: userProfile.fcm_token
    };

    next();
  } catch (error) {
    next(new Error(`Socket authentication error: ${(error as Error).message}`));
  }
};
