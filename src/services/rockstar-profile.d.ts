export type RockstarProfile = {
    username: string;
    avatar?: string;
    profileUrl: string;
    rawHtml?: string;
};
export declare function fetchRockstarProfile(username: string): Promise<RockstarProfile | null>;
//# sourceMappingURL=rockstar-profile.d.ts.map