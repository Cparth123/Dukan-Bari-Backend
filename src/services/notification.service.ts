import { supabaseAdmin } from '../config/supabase';
import { config } from '../config/env';

export interface PushNotificationPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class NotificationService {
  /**
   * Dispatch push notification to a single device (e.g. offline chat recipient)
   */
  public static async sendToDevice(payload: PushNotificationPayload): Promise<boolean> {
    if (!payload.token) {
      return false;
    }

    try {
      // In production with Firebase Admin SDK or FCM HTTP v1:
      // await admin.messaging().send({
      //   token: payload.token,
      //   notification: { title: payload.title, body: payload.body },
      //   data: payload.data
      // });

      console.log(`[FCM Push] Sent to device ${payload.token.substring(0, 12)}...: ${payload.title} - ${payload.body}`);
      return true;
    } catch (error) {
      console.error('[FCM Push Error]', error);
      return false;
    }
  }

  /**
   * Send chat message notification to an offline user
   */
  public static async notifyOfflineUser(
    recipientId: string,
    senderName: string,
    messagePreview: string,
    conversationId: string
  ): Promise<void> {
    try {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('fcm_token')
        .eq('id', recipientId)
        .single();

      if (user?.fcm_token) {
        await this.sendToDevice({
          token: user.fcm_token,
          title: `New message from ${senderName}`,
          body: messagePreview,
          data: {
            type: 'chat_message',
            conversationId
          }
        });
      }
    } catch (err) {
      console.error('Failed to notify offline user:', err);
    }
  }

  /**
   * Dispatch batch notifications for store announcements to all users within radius_km
   */
  public static async broadcastOfferToNearbyUsers(
    storeId: string,
    storeName: string,
    offerTitle: string,
    discountTag?: string,
    radiusKm: number = 3.0
  ): Promise<{ targetedCount: number; successCount: number }> {
    try {
      // Query users located within radius using stored procedure get_nearby_users_for_offer
      const { data: nearbyUsers, error } = await supabaseAdmin.rpc('get_nearby_users_for_offer', {
        p_store_id: storeId,
        p_radius_km: radiusKm
      });

      if (error || !nearbyUsers || nearbyUsers.length === 0) {
        console.log(`[Offer Broadcast] No nearby registered devices found within ${radiusKm}km of store ${storeName}`);
        return { targetedCount: 0, successCount: 0 };
      }

      console.log(`[Offer Broadcast] Found ${nearbyUsers.length} active users within ${radiusKm}km of ${storeName}`);

      let successCount = 0;
      const title = discountTag 
        ? `🔥 ${discountTag}: ${storeName}` 
        : `Special deal near you from ${storeName}!`;

      for (const recipient of nearbyUsers) {
        if (recipient.fcm_token) {
          const sent = await this.sendToDevice({
            token: recipient.fcm_token,
            title,
            body: offerTitle,
            data: {
              type: 'announcement',
              storeId
            }
          });
          if (sent) successCount++;
        }
      }

      return {
        targetedCount: nearbyUsers.length,
        successCount
      };
    } catch (err) {
      console.error('[Offer Broadcast Error]', err);
      return { targetedCount: 0, successCount: 0 };
    }
  }
}
