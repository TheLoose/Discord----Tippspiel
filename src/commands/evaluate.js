const { SlashCommandBuilder } = require('discord.js');
const { query } = require('../db/database');
const { isModerator } = require('../utils/helpers');
const { evaluateMatch } = require('./matchday');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evaluate')
    .setDescription('Set the winner of a single match and award points (mod only)')
    .addIntegerOption(opt => opt.setName('match_id').setDescription('Match ID').setRequired(true))
    .addStringOption(opt =>
      opt.setName('winner')
        .setDescription('Which team won?')
        .setRequired(true)
        .addChoices(
          { name: 'Team A', value: 'a' },
          { name: 'Team B', value: 'b' }
        )
    ),

  async execute(interaction) {
    if (!isModerator(interaction.member)) {
      return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const matchId    = interaction.options.getInteger('match_id');
    const winnerSide = interaction.options.getString('winner');

    const [match] = await query(
      `SELECT m.*,
              l.name AS league_name, l.emoji AS league_emoji,
              t1.name AS team_a, t1.emoji AS team_a_emoji,
              t2.name AS team_b, t2.emoji AS team_b_emoji
       FROM matches m
       JOIN leagues l  ON m.league_id  = l.id
       JOIN teams   t1 ON m.team_a_id  = t1.team_id
       JOIN teams   t2 ON m.team_b_id  = t2.team_id
       WHERE m.id = ?`,
      [matchId]
    );

    if (!match)                       return interaction.editReply(`❌ Match ID ${matchId} not found.`);
    if (match.status === 'evaluated') return interaction.editReply(`❌ Match \`${matchId}\` has already been evaluated.`);
    if (match.status === 'open')      return interaction.editReply(`⚠️ Match \`${matchId}\` is still open. Close it first with \`/match close\`.`);

    const { correct, wrong } = await evaluateMatch(interaction.client, match, winnerSide);

    const winnerName  = winnerSide === 'a' ? match.team_a  : match.team_b;
    const winnerEmoji = winnerSide === 'a' ? match.team_a_emoji : match.team_b_emoji;

    return interaction.editReply(
      `✅ Match \`${matchId}\` evaluated!\n` +
      `🏅 Winner: **${winnerEmoji} ${winnerName}**\n` +
      `✅ ${correct} correct — ❌ ${wrong} wrong`
    );
  }
};
