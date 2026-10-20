export type UserRole = 'superadmin' | 'shop_owner' | 'customer';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export type MessageType = 'text' | 'image' | 'price_quote';

export type EnquiryStatus = 'open' | 'fulfilled' | 'cancelled' | 'expired';

export interface AuthUser {
  id: string;
  phone_number: string;
  role: UserRole;
  full_name: string;
  fcm_token?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface ShowcaseProduct {
  id?: string;
  name: string;
  price: number;
  unit?: string;
  image_url?: string;
}

export type BusinessOfferingType = 'product_selling' | 'service_providing' | 'both';

export interface Store {
  id: string;
  owner_id: string;
  store_name: string;
  category: string;
  business_offering_type?: BusinessOfferingType;
  address_line: string;
  city: string;
  state?: string;
  pincode: string;
  latitude: number;
  longitude: number;
  is_live_open: boolean;
  standard_open_time: string;
  standard_close_time: string;
  verification_status: VerificationStatus;
  banner_url?: string | null;
  product_photos?: string[];
  showcase_products?: ShowcaseProduct[];
  rating?: number;
  phone_contact?: string | null;
  whatsapp_number?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NearbyStoreResponse extends Store {
  distance_meters: number;
  distance_km: number;
  dynamic_status: string;
  status_badge_color: string;
  active_offers_count: number;
}

export interface Announcement {
  id: string;
  store_id: string;
  title: string;
  description: string;
  discount_tag?: string;
  banner_image?: string;
  valid_until: string;
  radius_km: number;
  is_active: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  store_id: string;
  customer_id: string;
  last_message?: string;
  last_message_at: string;
  unread_count_merchant: number;
  unread_count_customer: number;
  created_at: string;
  updated_at: string;
}

export interface MessageMetadata {
  item_name?: string;
  quoted_price?: number;
  valid_until?: string;
  quantity?: string;
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: MessageType;
  content: string;
  media_url?: string | null;
  metadata?: MessageMetadata;
  is_read: boolean;
  created_at: string;
}

export interface ReverseEnquiry {
  id: string;
  customer_id: string;
  title: string;
  description: string;
  category?: string;
  media_url?: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  status: EnquiryStatus;
  created_at: string;
  expires_at: string;
}

export interface EnquiryResponse {
  id: string;
  enquiry_id: string;
  store_id: string;
  is_available: boolean;
  price_quote?: number;
  note?: string;
  media_url?: string;
  created_at: string;
}
