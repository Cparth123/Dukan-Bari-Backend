# Dukan-Bari-Backend

Hyperlocal Store Discovery & Live Merchant Platform - Real-time Node.js Express & Socket.IO Backend Server.

## Features
- **Real-Time WebSockets**: Live order notifications, customer-merchant messaging, instant quote bargaining.
- **REST APIs**: Store catalog management, product/service CRUD, image uploads with Supabase Storage integration.
- **Reverse Enquiry Broadcast**: Real-time push broadcasts to local merchants within 1-5 km radius.
- **Multi-Role Support**: Dukandars (Shop owners), Service providers (Doctors, Advocates, Tailors, Electricians), and Customers.

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your Supabase credentials:
```bash
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_supabase_service_role_secret
SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
npm start
```
