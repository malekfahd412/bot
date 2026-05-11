export declare const COLORS: {
    readonly primary: "#C8A951";
    readonly secondary: "#1A1A2E";
    readonly accent: "#E94560";
    readonly success: "#00D26A";
    readonly danger: "#FF4757";
    readonly warning: "#FFA502";
    readonly background: "#0D0D1A";
    readonly surface: "#16213E";
    readonly surfaceAlt: "#1A1A2E";
    readonly text: "#FFFFFF";
    readonly textMuted: "#8B8FA8";
    readonly gold: "#FFD700";
    readonly platinum: "#E5E4E2";
    readonly xpBar: "#C8A951";
    readonly xpBarBg: "#2A2A3E";
};
export declare const DIFFICULTY_CONFIG: {
    readonly easy: {
        readonly label: "EASY";
        readonly xp: 100;
        readonly coins: 500;
        readonly color: "#00D26A";
        readonly multiplier: 1;
    };
    readonly normal: {
        readonly label: "NORMAL";
        readonly xp: 250;
        readonly coins: 1250;
        readonly color: "#FFA502";
        readonly multiplier: 1.5;
    };
    readonly hard: {
        readonly label: "HARD";
        readonly xp: 500;
        readonly coins: 2500;
        readonly color: "#FF4757";
        readonly multiplier: 2;
    };
};
export type Difficulty = keyof typeof DIFFICULTY_CONFIG;
export declare const RANK_THRESHOLDS: readonly [{
    readonly name: "CIVILIAN";
    readonly minLevel: 1;
    readonly color: "#8B8FA8";
    readonly icon: "👤";
}, {
    readonly name: "ASSOCIATE";
    readonly minLevel: 5;
    readonly color: "#00D26A";
    readonly icon: "🔫";
}, {
    readonly name: "SOLDIER";
    readonly minLevel: 10;
    readonly color: "#3498DB";
    readonly icon: "⚔️";
}, {
    readonly name: "ENFORCER";
    readonly minLevel: 20;
    readonly color: "#E67E22";
    readonly icon: "🛡️";
}, {
    readonly name: "LIEUTENANT";
    readonly minLevel: 30;
    readonly color: "#9B59B6";
    readonly icon: "🎯";
}, {
    readonly name: "CAPTAIN";
    readonly minLevel: 40;
    readonly color: "#E94560";
    readonly icon: "💀";
}, {
    readonly name: "UNDERBOSS";
    readonly minLevel: 60;
    readonly color: "#C8A951";
    readonly icon: "👑";
}, {
    readonly name: "BOSS";
    readonly minLevel: 80;
    readonly color: "#FFD700";
    readonly icon: "🏆";
}, {
    readonly name: "KINGPIN";
    readonly minLevel: 100;
    readonly color: "#E5E4E2";
    readonly icon: "💎";
}];
export declare const XP_PER_LEVEL = 500;
export declare const DAILY_REWARD: {
    xp: number;
    coins: number;
    streakBonus: {
        xp: number;
        coins: number;
    };
};
export declare const STREAK_MILESTONES: number[];
export declare const MAX_CREW_SIZE = 10;
export declare const MAX_HEIST_TEAMMATES = 4;
//# sourceMappingURL=constants.d.ts.map