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
exports.loadCommands = loadCommands;
const discord_js_1 = require("discord.js");
const profile = __importStar(require("../commands/profile.js"));
const daily = __importStar(require("../commands/daily.js"));
const leaderboard = __importStar(require("../commands/leaderboard.js"));
const stats = __importStar(require("../commands/stats.js"));
const heistLog = __importStar(require("../commands/heist-log.js"));
const playerinfo = __importStar(require("../commands/playerinfo.js"));
const crew = __importStar(require("../commands/crew.js"));
const inventory = __importStar(require("../commands/inventory.js"));
const admin = __importStar(require("../commands/admin.js"));
const logger_js_1 = require("../utils/logger.js");
function loadCommands() {
    const commands = new discord_js_1.Collection();
    const modules = [
        profile,
        daily,
        leaderboard,
        stats,
        heistLog,
        playerinfo,
        crew,
        inventory,
        admin,
    ];
    for (const mod of modules) {
        commands.set(mod.data.name, mod);
        logger_js_1.logger.info(`Loaded command: /${mod.data.name}`);
    }
    logger_js_1.logger.success(`${commands.size} commands loaded`);
    return commands;
}
//# sourceMappingURL=command-loader.js.map