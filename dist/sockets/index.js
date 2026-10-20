"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketServer = void 0;
const socketAuth_1 = require("./socketAuth");
const chatHandler_1 = require("./chatHandler");
const storeHandler_1 = require("./storeHandler");
const initializeSocketServer = (io) => {
    // Apply token authentication middleware
    io.use(socketAuth_1.socketAuthMiddleware);
    io.on('connection', (socket) => {
        const user = socket.data.user;
        console.log(`[Socket Connected] User ${user.full_name} (${user.id}) | Role: ${user.role} | Socket ID: ${socket.id}`);
        // Join personal user room for direct alerts & notifications
        socket.join(`user:${user.id}`);
        // If shop owner, also join merchant room
        if (user.role === 'shop_owner' || user.role === 'superadmin') {
            socket.join(`store_owner:${user.id}`);
        }
        // Register modular feature handlers
        (0, chatHandler_1.registerChatHandlers)(io, socket);
        (0, storeHandler_1.registerStoreHandlers)(io, socket);
        socket.on('disconnect', (reason) => {
            console.log(`[Socket Disconnected] User ${user.full_name} (${user.id}) | Reason: ${reason}`);
        });
    });
};
exports.initializeSocketServer = initializeSocketServer;
