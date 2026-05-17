export interface RockstarProfile {
    display_name: string;
    rid?: string;
    avatar?: string;
    crewName?: string;
    crewTag?: string;
    country?: string;
    profileUrl: string;
}
export declare function fetchRockstarProfile(display_name: string): Promise<RockstarProfile | null>;
//# sourceMappingURL=rockstar-browser.d.ts.map