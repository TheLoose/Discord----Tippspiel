const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { query } = require('../db/database');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the leaderboard for a league')
    .addIntegerOption(opt =>
      opt.setName('league_id')
        .setDescription('League ID (use /league list to see IDs)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const leagueId = interaction.options.getInteger('league_id');

    const [league] = await query('SELECT * FROM leagues WHERE id = ?', [leagueId]);
    if (!league) {
      return interaction.reply({ content: `❌ League ID ${leagueId} not found.`, ephemeral: true });
    }

    const rows = await query(
      `SELECT username, total, correct, total_votes
       FROM points
       WHERE league_id = ?
       ORDER BY total DESC, correct DESC
       LIMIT 10`,
      [leagueId]
    );

    if (!rows.length) {
      return interaction.reply({
        content: `No points recorded yet for **${league.emoji} ${league.name}**.`,
        ephemeral: true
      });
    }

    const lines = rows.map((row, i) => {
      const medal    = MEDALS[i] ?? `**${i + 1}.**`;
      const accuracy = row.total_votes > 0
        ? Math.round((row.correct / row.total_votes) * 100)
        : 0;
      return `${medal} **${row.username}** — ${row.total} pts · ${row.correct}/${row.total_votes} correct (${accuracy}%)`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`${league.emoji} ${league.name} — Leaderboard`)
      .setColor(0xf39c12)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
