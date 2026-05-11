export interface RockstarProfile {
    username: string;
    rid?: string;
    avatar?: string;
    crewName?: string;
    crewTag?: string;
    country?: string;
    profileUrl: string;
}
export declare function fetchRockstarProfile(username: string): Promise<RockstarProfile | null>;
//# sourceMappingURL=rockstar-browser.d.ts.map