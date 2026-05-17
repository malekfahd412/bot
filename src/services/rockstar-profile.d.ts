export type RockstarProfile = {
    display_name: string;
    avatar?: string;
    profileUrl: string;
    rawHtml?: string;
};
export declare function fetchRockstarProfile(display_name: string): Promise<RockstarProfile | null>;
//# sourceMappingURL=rockstar-profile.d.ts.map