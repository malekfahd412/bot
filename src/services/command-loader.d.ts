import { Collection } from 'discord.js';
type CommandModule = {
    data: {
        name: string;
        toJSON?: () => unknown;
    };
    execute: (interaction: import('discord.js').ChatInputCommandInteraction) => Promise<void>;
};
export declare function loadCommands(): Collection<string, CommandModule>;
export {};
//# sourceMappingURL=command-loader.d.ts.map