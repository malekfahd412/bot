"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrewSystem = void 0;
const db_js_1 = require("../database/db.js");
const constants_js_1 = require("../utils/constants.js");
const logger_js_1 = require("../utils/logger.js");
class CrewSystem {
    static create(name, tag, ownerId, description) {
        if (name.length < 2 || name.length > 32)
            throw new Error('Crew name must be 2–32 characters');
        if (tag.length < 2 || tag.length > 5)
            throw new Error('Crew tag must be 2–5 characters');
        const existingName = db_js_1.CrewDB.findByName(name);
        if (existingName)
            throw new Error('A crew with that name already exists');
        const existingTag = db_js_1.CrewDB.findByTag(tag);
        if (existingTag)
            throw new Error('A crew with that tag already exists');
        const owner = db_js_1.PlayerDB.findByDiscordId(ownerId);
        if (owner?.crew_id)
            throw new Error('You are already in a crew');
        const crew = db_js_1.CrewDB.create(name, tag.toUpperCase(), ownerId, description);
        logger_js_1.logger.game(`Crew created: ${crew.name} [${crew.tag}] by ${ownerId}`);
        return crew;
    }
    static join(crewId, discordId) {
        const crew = db_js_1.CrewDB.findById(crewId);
        if (!crew)
            throw new Error('Crew not found');
        const player = db_js_1.PlayerDB.findByDiscordId(discordId);
        if (!player)
            throw new Error('Player not found. Use any command first to register.');
        if (player.crew_id)
            throw new Error('You are already in a crew. Leave it first.');
        if (crew.member_count >= constants_js_1.MAX_CREW_SIZE)
            throw new Error(`Crew is full (max ${constants_js_1.MAX_CREW_SIZE} members)`);
        db_js_1.CrewDB.addMember(crewId, discordId);
        logger_js_1.logger.game(`${discordId} joined crew ${crew.name}`);
    }
    static leave(discordId) {
        const player = db_js_1.PlayerDB.findByDiscordId(discordId);
        if (!player?.crew_id)
            throw new Error('You are not in a crew');
        const crew = db_js_1.CrewDB.findById(player.crew_id);
        if (crew?.owner_id === discordId)
            throw new Error('You are the crew owner. Transfer ownership or disband first.');
        db_js_1.CrewDB.removeMember(player.crew_id, discordId);
        logger_js_1.logger.game(`${discordId} left crew ${player.crew_id}`);
    }
    static getWithMembers(crewId) {
        const crew = db_js_1.CrewDB.findById(crewId);
        if (!crew)
            return undefined;
        const members = db_js_1.CrewDB.getMembers(crewId);
        return { ...crew, members };
    }
    static getPlayerCrew(discordId) {
        const player = db_js_1.PlayerDB.findByDiscordId(discordId);
        if (!player?.crew_id)
            return undefined;
        return this.getWithMembers(player.crew_id);
    }
    // Atomic single-query update — no race condition
    static recordHeistResult(crewId, earnings) {
        db_js_1.CrewDB.recordHeistEarnings(crewId, earnings);
    }
    static getLeaderboard(limit = 10) {
        return db_js_1.CrewDB.getLeaderboard(limit);
    }
}
exports.CrewSystem = CrewSystem;
//# sourceMappingURL=crew.js.map