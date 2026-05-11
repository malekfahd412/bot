"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
const logger_js_1 = require("./utils/logger.js");
// Import slash command builders directly — avoids the execute() handler
const profile_js_1 = require("./commands/profile.js");
const daily_js_1 = require("./commands/daily.js");
const leaderboard_js_1 = require("./commands/leaderboard.js");
const stats_js_1 = require("./commands/stats.js");
const heist_log_js_1 = require("./commands/heist-log.js");
const crew_js_1 = require("./commands/crew.js");
const inventory_js_1 = require("./commands/inventory.js");
const admin_js_1 = require("./commands/admin.js");
(0, dotenv_1.config)();
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
if (!TOKEN || !CLIENT_ID) {
    logger_js_1.logger.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env');
    process.exit(1);
}
const commandData = [
    profile_js_1.data, daily_js_1.data, leaderboard_js_1.data, stats_js_1.data, heist_log_js_1.data, crew_js_1.data, inventory_js_1.data, admin_js_1.data,
].map(cmd => cmd.toJSON());
const rest = new discord_js_1.REST({ version: '10' }).setToken(TOKEN);
(async () => {
    try {
        logger_js_1.logger.info(`Registering ${commandData.length} slash commands...`);
        if (GUILD_ID) {
            await rest.put(discord_js_1.Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandData });
            logger_js_1.logger.success(`Registered ${commandData.length} commands to guild ${GUILD_ID}`);
        }
        else {
            await rest.put(discord_js_1.Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandData });
            logger_js_1.logger.success(`Registered ${commandData.length} global commands`);
        }
    }
    catch (err) {
        logger_js_1.logger.error('Failed to register commands:', err);
        process.exit(1);
    }
})();
//# sourceMappingURL=deploy-commands.js.map