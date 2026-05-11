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
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
const logger_js_1 = require("./utils/logger.js");
const command_loader_js_1 = require("./services/command-loader.js");
const readyEvent = __importStar(require("./events/ready.js"));
const interactionEvent = __importStar(require("./events/interaction-create.js"));
(0, dotenv_1.config)();
// ── Environment validation ──────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
if (!TOKEN) {
    logger_js_1.logger.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill in your token.');
    process.exit(1);
}
// PostgreSQL notice — SQLite is used by default
if (process.env.DATABASE_URL) {
    logger_js_1.logger.warn('DATABASE_URL detected. The bot currently uses SQLite by default.');
    logger_js_1.logger.warn('To switch to PostgreSQL: run pg-schema.sql against your database, then update db.ts to use the pg adapter.');
    logger_js_1.logger.warn('Continuing with SQLite for now...');
}
// ── Discord client ──────────────────────────────────────────────────────────
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.GuildMembers,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
    partials: [discord_js_1.Partials.Message, discord_js_1.Partials.Channel, discord_js_1.Partials.GuildMember],
});
// ── Commands ────────────────────────────────────────────────────────────────
const commands = (0, command_loader_js_1.loadCommands)();
// ── Events ──────────────────────────────────────────────────────────────────
client.once(readyEvent.name, (...args) => readyEvent.execute(...args));
client.on(interactionEvent.name, (interaction) => interactionEvent.execute(interaction, commands, {
    reviewChannelId: REVIEW_CHANNEL_ID,
}));
// ── Process handlers ────────────────────────────────────────────────────────
process.on('SIGINT', () => {
    logger_js_1.logger.info('SIGINT received — shutting down gracefully...');
    client.destroy();
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger_js_1.logger.info('SIGTERM received — shutting down gracefully...');
    client.destroy();
    process.exit(0);
});
process.on('unhandledRejection', (err) => {
    logger_js_1.logger.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
    logger_js_1.logger.error('Uncaught exception:', err);
    process.exit(1);
});
// ── Start ───────────────────────────────────────────────────────────────────
logger_js_1.logger.info('Starting GTA Heist RPG Bot...');
client.login(TOKEN).catch(err => {
    logger_js_1.logger.error('Login failed:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map