const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { query } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mypoints')
    .setDescription("Shows your points for all leagues"),

  async execute(interaction) {
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;

    const rows = await query(
      `SELECT l.emoji, l.name, p.correct, p.total_votes,
              ROUND(p.correct / NULLIF(p.total_votes, 0) * 100, 1) AS accuracy
       FROM   leagues l
       JOIN   points p ON p.league_id = l.id
       WHERE  p.user_id = ?
         AND  l.guild_id = ?`,
      [userId, guildId]
    );

    if (!rows.length) {
      return interaction.reply({
        content: 'No points recorded yet for this server.',
        ephemeral: true
      });
    }

    const lines = rows.map(row =>
      `${row.emoji} **${row.name}** — ${row.correct} correct / ${row.total_votes} votes — **${row.accuracy ?? 0}%**`
    );

    const embed = new EmbedBuilder()
      .setTitle(`Your Points`)
      .setColor(0x5AEDCD)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};