"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const store_routes_1 = __importDefault(require("./store.routes"));
const chat_routes_1 = __importDefault(require("./chat.routes"));
const enquiry_routes_1 = __importDefault(require("./enquiry.routes"));
const announcement_routes_1 = __importDefault(require("./announcement.routes"));
const upload_routes_1 = __importDefault(require("./upload.routes"));
const router = (0, express_1.Router)();
// Health check endpoint
router.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Dukan Bari Hyperlocal API & Real-Time Engine'
    });
});
router.use('/stores', store_routes_1.default);
router.use('/chat', chat_routes_1.default);
router.use('/enquiries', enquiry_routes_1.default);
router.use('/announcements', announcement_routes_1.default);
router.use('/upload', upload_routes_1.default);
exports.default = router;
