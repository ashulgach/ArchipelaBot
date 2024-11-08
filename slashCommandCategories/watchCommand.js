const { SlashCommandBuilder } = require('discord.js');
const { dbExecute, dbQueryOne, dbQueryAll } = require('../database');

const watchCommand = {
    commandBuilder: new SlashCommandBuilder()
        .setName('watch')
        .setDescription('Set a watch for a specific word in this channel')
        .addStringOption(option => 
            option.setName('word')
                .setDescription('The word to watch for')
                .setRequired(true)),

    execute: async (interaction) => {
        const word = interaction.options.getString('word').toLowerCase();
        const channelId = interaction.channelId;
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        try {
            // Check if the watch already exists
            const existingWatch = await dbQueryOne(
                'SELECT * FROM watches WHERE guildId = ? AND channelId = ? AND word = ? AND userId = ?',
                [guildId, channelId, word, userId]
            );

            if (existingWatch) {
                return interaction.reply({ content: `You're already watching for '${word}' in this channel.`, ephemeral: true });
            }

            // Add the new watch
            await dbExecute(
                'INSERT INTO watches (guildId, channelId, word, userId) VALUES (?, ?, ?, ?)',
                [guildId, channelId, word, userId]
            );

            await interaction.reply({ content: `Watch set for '${word}' in this channel.`, ephemeral: true });
        } catch (error) {
            console.error('Error setting watch:', error);
            await interaction.reply({ content: 'An error occurred while setting the watch.', ephemeral: true });
        }
    }
};

module.exports = {
    commands: [watchCommand],
    messageListener: async (client, message) => {
        const channelId = message.channelId;
        const guildId = message.guildId;
        const content = message.content.toLowerCase();

        try {
            const watches = await dbQueryAll(
                'SELECT * FROM watches WHERE guildId = ? AND channelId = ?',
                [guildId, channelId]
            );

            if (watches) {
                for (const watch of watches) {
                    if (content.includes(watch.word)) {
                        const user = await client.users.fetch(watch.userId);
                        await message.channel.send(`${user}, your BK'd item '${watch.word}' was found!`);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking watches:', error);
        }
    }
};