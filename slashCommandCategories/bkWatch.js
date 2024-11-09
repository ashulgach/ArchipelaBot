const { SlashCommandBuilder } = require('discord.js');
const { dbExecute, dbQueryOne, dbQueryAll } = require('../database');
const Fuse = require('fuse.js');

const bkWatchCommand = {
    commandBuilder: new SlashCommandBuilder()
        .setName('bk-watch')
        .setDescription('Get notified when a specific item is found in any world')
        .addStringOption(option => 
            option.setName('item')
                .setDescription('The item name to watch for (partial matches work)')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('delete-after-match')
                .setDescription('Delete the watch after the first match')
                .setRequired(false)),

    execute: async (interaction) => {
        const itemPattern = interaction.options.getString('item').toLowerCase();
        const deleteAfterMatch = interaction.options.getBoolean('delete-after-match') ?? false;
        const channelId = interaction.channelId;
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        try {
            const existingWatch = await dbQueryOne(
                'SELECT * FROM bk_watches WHERE guildId = ? AND channelId = ? AND itemPattern = ? AND userId = ?',
                [guildId, channelId, itemPattern, userId]
            );

            if (existingWatch) {
                return interaction.reply({ 
                    content: `You're already watching for items matching '${itemPattern}' in this channel.`, 
                    ephemeral: true 
                });
            }

            await dbExecute(
                'INSERT INTO bk_watches (guildId, channelId, itemPattern, userId, deleteAfterMatch) VALUES (?, ?, ?, ?, ?)',
                [guildId, channelId, itemPattern, userId, deleteAfterMatch ? 1 : 0]
            );

            await interaction.reply({ 
                content: `Watch set for items matching '${itemPattern}' in this channel${deleteAfterMatch ? ' (will be deleted after first match)' : ''}.`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error setting item watch:', error);
            await interaction.reply({ 
                content: 'An error occurred while setting the watch.', 
                ephemeral: true 
            });
        }
    }
};

const bkWatchListCommand = {
    commandBuilder: new SlashCommandBuilder()
        .setName('bk-watch-list')
        .setDescription('List all your active watches in this channel'),

    execute: async (interaction) => {
        const channelId = interaction.channelId;
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        try {
            const watches = await dbQueryAll(
                'SELECT * FROM bk_watches WHERE guildId = ? AND channelId = ? AND userId = ?',
                [guildId, channelId, userId]
            );

            if (!watches) {
                return interaction.reply({
                    content: 'You have no active watches in this channel.',
                    ephemeral: true
                });
            }

            const watchList = watches.map((watch, index) => 
                `${index + 1}. "${watch.itemPattern}"${watch.deleteAfterMatch ? ' (deletes after match)' : ''}`
            ).join('\n');

            await interaction.reply({
                content: `Your active watches in this channel:\n${watchList}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error listing watches:', error);
            await interaction.reply({
                content: 'An error occurred while listing watches.',
                ephemeral: true
            });
        }
    }
};

const bkWatchDeleteCommand = {
    commandBuilder: new SlashCommandBuilder()
        .setName('bk-watch-delete')
        .setDescription('Delete a watch for an item or all your watches')
        .addStringOption(option => 
            option.setName('item')
                .setDescription('The item pattern to stop watching (leave empty to delete all watches)')
                .setRequired(false)),

    execute: async (interaction) => {
        const itemPattern = interaction.options.getString('item')?.toLowerCase();
        const channelId = interaction.channelId;
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        try {
            if (itemPattern) {
                // Delete specific watch and get changes in the same statement
                const result = await dbQueryOne(
                    `WITH deleted AS (
                        DELETE FROM bk_watches 
                        WHERE guildId = ? AND channelId = ? AND itemPattern = ? AND userId = ?
                        RETURNING *
                    ) SELECT count(*) as count FROM deleted`,
                    [guildId, channelId, itemPattern, userId]
                );

                if (result?.count > 0) {
                    await interaction.reply({
                        content: `Deleted watch for '${itemPattern}'.`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `No watch found for '${itemPattern}'.`,
                        ephemeral: true
                    });
                }
            } else {
                // Delete all watches and get count in the same statement
                const result = await dbQueryOne(
                    `WITH deleted AS (
                        DELETE FROM bk_watches 
                        WHERE guildId = ? AND channelId = ? AND userId = ?
                        RETURNING *
                    ) SELECT count(*) as count FROM deleted`,
                    [guildId, channelId, userId]
                );

                if (result?.count > 0) {
                    await interaction.reply({
                        content: `Deleted all your watches in this channel (${result.count} watch${result.count === 1 ? '' : 'es'}).`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: 'You had no watches in this channel.',
                        ephemeral: true
                    });
                }
            }
        } catch (error) {
            console.error('Error deleting watch:', error);
            await interaction.reply({
                content: 'An error occurred while deleting the watch(es).',
                ephemeral: true
            });
        }
    }
};

module.exports = {
    commands: [bkWatchCommand, bkWatchListCommand, bkWatchDeleteCommand]
};
