# 🏪 Dukan Bari - Node.js + Firebase Backend Server

Centralized backend server for the Dukan Bari platform, eliminating direct client database calls from Web, Customer App, and Shopkeeper App.

---

## 🚀 Server Architecture & Tech Stack

- **REST API Framework:** Express.js (`src/server.js`)
- **Real-Time Engine:** Socket.io (`src/socket/index.js`) for instant messaging, typing indicators, live merchant status toggle, and enquiry radar.
- **Database:** Firebase Cloud Firestore + Firebase Admin SDK (`src/config/firebase.js`), with intelligent local in-memory fallback.
- **Authentication:** JWT Token Security (`src/middleware/auth.js`) + Google Sign-In verification (`src/services/googleAuth.js`).
- **Media Engine:** Cloudinary API + Multer (`src/config/cloudinary.js` & `src/middleware/upload.js`) for product photos, demo videos, store banners, and review photos.

---

## 🗄️ Database Architecture (Firebase Firestore Collections)

All legacy Supabase tables have been modeled as high-performance Firebase Firestore collections:

| Collection | Model File | Purpose | Key Attributes |
| :--- | :--- | :--- | :--- |
| `users` | [`src/models/User.js`](file:///E:/Dukan%20Bari/backend/src/models/User.js) | Users & Role Profiles | `id`, `email`, `phone`, `full_name`, `role` (`customer` \| `dukandar` \| `superadmin`), `avatar_url` |
| `stores` | [`src/models/Store.js`](file:///E:/Dukan%20Bari/backend/src/models/Store.js) | Dukans & Hyperlocal Directory | `id`, `owner_id`, `name`, `category`, `address`, `latitude`, `longitude`, `is_live_open`, `rating` |
| `products` | [`src/models/Product.js`](file:///E:/Dukan%20Bari/backend/src/models/Product.js) | Product & Service Catalog | `id`, `store_id`, `name`, `price`, `offer_price`, `unit`, `in_stock`, `image_url`, `video_url` |
| `conversations` | [`src/models/Conversation.js`](file:///E:/Dukan%20Bari/backend/src/models/Conversation.js) | Customer-to-Store Chat Threads | `id`, `customer_id`, `store_id`, `last_message`, `last_message_at`, unread counters |
| `messages` | [`src/models/Message.js`](file:///E:/Dukan%20Bari/backend/src/models/Message.js) | Real-time Chat Messages | `id`, `conversation_id`, `sender_id`, `sender_role`, `text`, `media_url`, `media_type`, `is_read` |
| `enquiries` | [`src/models/Enquiry.js`](file:///E:/Dukan%20Bari/backend/src/models/Enquiry.js) | Reverse Customer Radar Enquiries | `id`, `customer_id`, `category`, `query`, `budget`, `latitude`, `longitude`, `radius_km`, `status` |
| `enquiry_responses`| [`src/models/Enquiry.js`](file:///E:/Dukan%20Bari/backend/src/models/Enquiry.js) | Merchant Live Quotes & Bids | `id`, `enquiry_id`, `store_id`, `message`, `price`, `status` |
| `offers` | [`src/models/Offer.js`](file:///E:/Dukan%20Bari/backend/src/models/Offer.js) | Flash Deals & Promotional Banners | `id`, `store_id`, `title`, `description`, `discount_pct`, `code`, `banner_url`, `is_active` |
| `store_reviews` | [`src/models/Review.js`](file:///E:/Dukan%20Bari/backend/src/models/Review.js) | Customer Ratings & Store Reviews | `id`, `store_id`, `user_id`, `user_name`, `rating`, `comment`, `photos` |

---

## 📡 API Endpoints

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/register` - Create customer or dukandar account (auto-creates store for dukandars)
- `POST /api/auth/login` - Authenticate via email or phone + password -> returns JWT
- `POST /api/auth/google` - Verifies Google OAuth token -> returns Dukan Bari JWT
- `GET /api/auth/me` - Validates Bearer token & returns active profile

### 🏪 Stores (`/api/stores`)
- `GET /api/stores` - Hyperlocal discovery radar (supports `lat`, `lng`, `radius`, `category`, `is_live_open`)
- `GET /api/stores/:id` - Full store profile with catalog and reviews
- `POST /api/stores` - Create new store (dukandar only)
- `PUT /api/stores/:id` - Update store profile
- `PATCH /api/stores/:id/status` - 1-Tap toggle live open/closed status (broadcasts via Socket.io)

### 📦 Products (`/api/products`)
- `GET /api/products/store/:storeId` - Fetch store product catalog
- `GET /api/products/search?q=term` - Global keyword search
- `POST /api/products` - Add product with pricing, unit, image & video
- `PUT /api/products/:id` - Update product details or stock
- `DELETE /api/products/:id` - Delete product

### 💬 Conversations & Real-Time Chat (`/api/conversations`)
- `GET /api/conversations` - List user/dukandar chat threads
- `POST /api/conversations` - Start or open conversation
- `GET /api/conversations/:id/messages` - Chat message history
- `POST /api/conversations/:id/messages` - Send message (also emits to Socket.io)

### 🎯 Hyperlocal Enquiries (`/api/enquiries`)
- `POST /api/enquiries` - Post reverse customer enquiry (broadcasts to radar)
- `GET /api/enquiries/my` - Customer's enquiry list
- `GET /api/enquiries/nearby` - Merchant radar for customer requests
- `POST /api/enquiries/:id/bid` - Merchant submits price quote (alerts customer)
- `GET /api/enquiries/:id/responses` - List quotes received

### 🏷️ Flash Deals & Offers (`/api/offers`)
- `GET /api/offers` - List active flash deals
- `POST /api/offers` - Create flash deal with banner & discount percentage

### ⭐ Store Reviews (`/api/reviews`)
- `GET /api/reviews/store/:storeId` - Reviews and ratings
- `POST /api/reviews` - Submit review (dynamically recalculates store average)

### ☁️ Media Uploads (`/api/upload`)
- `POST /api/upload/image` - Single image upload to Cloudinary (products, banners, avatars)
- `POST /api/upload/images` - Multi-image gallery upload
- `POST /api/upload/video` - Demo video upload to Cloudinary

---

## ⚡ Quick Start & Verification

### 1. Run Complete Server & API Test Suite
```bash
cd backend
npm run test:server
```
*Validates health check, registration, JWT authentication, store operations, product management, enquiries, and real-time Socket.io message delivery (9/9 passed).*

### 2. Run Database Test Suite
```bash
npm run db:test
```

### 3. Start Development Server
```bash
npm run dev
# or: npm start
```
*Server runs on `http://localhost:5000` with live Socket.io and Cloud Firestore.*
