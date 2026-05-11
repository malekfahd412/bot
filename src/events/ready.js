"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.once = exports.name = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const logger_js_1 = require("../utils/logger.js");
const db_js_1 = require("../database/db.js");
exports.name = discord_js_1.Events.ClientReady;
exports.once = true;
async function execute(client) {
    logger_js_1.logger.success(`Bot online as ${client.user?.tag}`);
    logger_js_1.logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
    // Initialize database on startup
    (0, db_js_1.getDB)();
    client.user?.setPresence({
        activities: [{ name: '🎯 /heist-log | GTA RPG', type: 0 }],
        status: 'online',
    });
    logger_js_1.logger.game('GTA Heist RPG is live. Let the operations begin.');
}
//# sourceMappingURL=ready.js.map