const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { query } = require('../db/database');
const { isModerator } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('league')
    .setDescription('Manage leagues (mod only)')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new league')
        .addStringOption(opt => opt.setName('name').setDescription('League name').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('League emoji').setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post matches in').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all leagues')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── CREATE ──────────────────────────────────────────────────────────────
    if (sub === 'create') {
      if (!isModerator(interaction.member)) {
        return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
      }

      const name      = interaction.options.getString('name');
      const emoji     = interaction.options.getString('emoji');
      const channel   = interaction.options.getChannel('channel');

      await query(
        'INSERT INTO leagues (name, emoji, channel_id) VALUES (?, ?, ?)',
        [name, emoji, channel.id]
      );

      return interaction.reply({
        content: `✅ League **${emoji} ${name}** created! Matches will be posted in ${channel}.`,
        ephemeral: true
      });
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const leagues = await query('SELECT * FROM leagues WHERE active = true ORDER BY id');

      if (!leagues.length) {
        return interaction.reply({ content: 'No leagues found. Create one with `/league create`.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 Active Leagues')
        .setColor(0x3498db)
        .setDescription(
          leagues.map(l =>
            `**${l.emoji} ${l.name}** (ID: ${l.id}) — <#${l.channel_id}>`
          ).join('\n')
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
