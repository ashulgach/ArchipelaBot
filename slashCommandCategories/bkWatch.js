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
                .setRequired(true)),

    execute: async (interaction) => {
        const itemPattern = interaction.options.getString('item').toLowerCase();
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
                'INSERT INTO bk_watches (guildId, channelId, itemPattern, userId) VALUES (?, ?, ?, ?)',
                [guildId, channelId, itemPattern, userId]
            );

            await interaction.reply({ 
                content: `Watch set for items matching '${itemPattern}' in this channel.`, 
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

module.exports = {
    commands: [bkWatchCommand]
};
