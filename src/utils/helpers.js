"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLevelFromXP = getLevelFromXP;
exports.getXPForNextLevel = getXPForNextLevel;
exports.getXPProgress = getXPProgress;
exports.getRank = getRank;
exports.formatNumber = formatNumber;
exports.formatCoins = formatCoins;
exports.getSuccessRate = getSuccessRate;
exports.truncate = truncate;
exports.chunkArray = chunkArray;
exports.parseUserMentions = parseUserMentions;
exports.sleep = sleep;
exports.isToday = isToday;
exports.isYesterday = isYesterday;
const constants_js_1 = require("./constants.js");
function getLevelFromXP(xp) {
    return Math.floor(xp / constants_js_1.XP_PER_LEVEL) + 1;
}
function getXPForNextLevel(currentXP) {
    const level = getLevelFromXP(currentXP);
    return level * constants_js_1.XP_PER_LEVEL;
}
function getXPProgress(currentXP) {
    const level = getLevelFromXP(currentXP);
    const levelStart = (level - 1) * constants_js_1.XP_PER_LEVEL;
    const levelEnd = level * constants_js_1.XP_PER_LEVEL;
    const current = currentXP - levelStart;
    const needed = levelEnd - levelStart;
    const percent = Math.min(current / needed, 1);
    return { current, needed, percent };
}
function getRank(level) {
    let rank = constants_js_1.RANK_THRESHOLDS[0];
    for (const r of constants_js_1.RANK_THRESHOLDS) {
        if (level >= r.minLevel)
            rank = r;
        else
            break;
    }
    return rank;
}
function formatNumber(n) {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}
function formatCoins(n) {
    return `$${formatNumber(n)}`;
}
function getSuccessRate(total, successful) {
    if (total === 0)
        return '0%';
    return `${Math.round((successful / total) * 100)}%`;
}
function truncate(str, maxLen) {
    if (str.length <= maxLen)
        return str;
    return str.slice(0, maxLen - 3) + '...';
}
function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}
function parseUserMentions(text) {
    const matches = text.match(/<@!?(\d+)>/g) ?? [];
    return matches.map(m => m.replace(/<@!?(\d+)>/, '$1'));
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function isToday(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    return date.toDateString() === now.toDateString();
}
function isYesterday(dateString) {
    const date = new Date(dateString);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
}
//# sourceMappingURL=helpers.js.map