"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRockstarProfile = fetchRockstarProfile;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
async function fetchRockstarProfile(username) {
    try {
        const url = `https://socialclub.rockstargames.com/member/${encodeURIComponent(username)}`;
        const res = await axios_1.default.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept-Language": "en-US,en;q=0.9",
            },
        });
        const html = res.data;
        const $ = cheerio.load(html);
        // 🖼️ الصورة (أفضل مصدر)
        const avatar = $('meta[property="og:image"]').attr("content") ||
            $('img').first().attr("src");
        // 🏷️ الاسم الحقيقي من الصفحة
        const ogTitle = $('meta[property="og:title"]').attr("content");
        const cleanUsername = ogTitle?.split(" | ")[0] || username;
        return {
            username: cleanUsername,
            avatar,
            profileUrl: url,
            rawHtml: html,
        };
    }
    catch (err) {
        console.error("Rockstar scrape error:", err);
        return null;
    }
}
//# sourceMappingURL=rockstar-profile.js.map