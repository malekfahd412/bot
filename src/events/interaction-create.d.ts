import { Events, Interaction, ChatInputCommandInteraction, Collection } from 'discord.js';
export declare const name = Events.InteractionCreate;
type CommandModule = {
    data: {
        name: string;
    };
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};
export declare function execute(interaction: Interaction, commands: Collection<string, CommandModule>, config: {
    reviewChannelId?: string;
}): Promise<void>;
export {};
//# sourceMappingURL=interaction-create.d.ts.map