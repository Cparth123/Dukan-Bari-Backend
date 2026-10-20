import { Server } from 'socket.io';
import { AuthenticatedSocket } from './socketAuth';
import { supabaseAdmin } from '../config/supabase';

export interface ToggleStatusPayload {
  storeId: string;
  isLiveOpen: boolean;
}

export interface EnquiryBroadcastPayload {
  enquiryId: string;
  title: string;
  category?: string;
  description: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export const registerStoreHandlers = (io: Server, socket: AuthenticatedSocket) => {
  const user = socket.data.user;

  // 1. One-tap Toggle Live Store Status (OPEN / CLOSED)
  socket.on('store:toggle_status', async (payload: ToggleStatusPayload) => {
    try {
      const { storeId, isLiveOpen } = payload;
      if (!storeId || typeof isLiveOpen !== 'boolean') {
        socket.emit('error', { message: 'Invalid store status payload' });
        return;
      }

      // Check merchant ownership or admin role
      const { data: store, error: fetchErr } = await supabaseAdmin
        .from('stores')
        .select('id, owner_id, store_name, category, standard_open_time, standard_close_time')
        .eq('id', storeId)
        .single();

      if (fetchErr || !store) {
        socket.emit('error', { message: 'Store not found' });
        return;
      }

      if (store.owner_id !== user.id && user.role !== 'superadmin') {
        socket.emit('error', { message: 'Unauthorized to change status of this store' });
        return;
      }

      // Update Supabase
      const { data: updatedStore, error: updateErr } = await supabaseAdmin
        .from('stores')
        .update({ is_live_open: isLiveOpen })
        .eq('id', storeId)
        .select()
        .single();

      if (updateErr) {
        socket.emit('error', { message: 'Failed to update store status', error: updateErr.message });
        return;
      }

      console.log(`[Store Status] Store "${store.store_name}" (${storeId}) toggled to ${isLiveOpen ? 'LIVE OPEN' : 'CLOSED'}`);

      // Broadcast store status change globally and to specific store room
      const broadcastPayload = {
        storeId,
        storeName: store.store_name,
        isLiveOpen,
        updatedAt: new Date().toISOString(),
        toggledBy: user.full_name
      };

      // Emit to store specific room
      io.to(`store:${storeId}`).emit('store:status_change', broadcastPayload);
      // Emit to platform live discovery feed
      io.emit('store:status_change', broadcastPayload);

      socket.emit('store:toggle_success', broadcastPayload);
    } catch (err) {
      console.error('Error handling store:toggle_status:', err);
      socket.emit('error', { message: 'Internal error updating store status' });
    }
  });

  // 2. Subscribe to real-time updates for a specific store (e.g., customer viewing store page)
  socket.on('store:subscribe', ({ storeId }: { storeId: string }) => {
    if (storeId) {
      socket.join(`store:${storeId}`);
    }
  });

  socket.on('store:unsubscribe', ({ storeId }: { storeId: string }) => {
    if (storeId) {
      socket.leave(`store:${storeId}`);
    }
  });

  // 3. Reverse Enquiry Real-time Broadcast to Nearby Merchants
  socket.on('enquiry:broadcast_new', async (payload: EnquiryBroadcastPayload) => {
    try {
      if (user.role !== 'customer' && user.role !== 'superadmin') {
        socket.emit('error', { message: 'Only customers can broadcast enquiries' });
        return;
      }

      // Find verified shops within radius
      const { data: nearbyStores, error } = await supabaseAdmin.rpc(
        'get_nearby_stores_with_status',
        {
          user_lat: payload.latitude,
          user_lng: payload.longitude,
          radius_meters: (payload.radiusKm || 3) * 1000,
          filter_category: payload.category || null,
          open_only: false
        }
      );

      if (!error && nearbyStores && nearbyStores.length > 0) {
        // Broadcast enquiry alert to each merchant's personal room
        for (const store of nearbyStores) {
          io.to(`store_owner:${store.owner_id || store.id}`).emit('enquiry:new_request', {
            enquiryId: payload.enquiryId,
            title: payload.title,
            description: payload.description,
            category: payload.category,
            distanceMeters: store.distance_meters,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error('Error broadcasting enquiry:', err);
    }
  });
};
