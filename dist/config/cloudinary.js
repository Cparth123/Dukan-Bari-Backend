"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = require("cloudinary");
const env_1 = require("./env");
cloudinary_1.v2.config({
    cloud_name: env_1.config.cloudinary.cloudName,
    api_key: env_1.config.cloudinary.apiKey,
    api_secret: env_1.config.cloudinary.apiSecret,
    secure: true
});
exports.default = cloudinary_1.v2;
