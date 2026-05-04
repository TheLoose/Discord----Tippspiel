const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { query } = require('../db/database');
const { buildMatchEmbed, isModerator, parseEmoji } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('Manage matches (mod only)')

    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Post a new match prediction')
        .addIntegerOption(opt => opt.setName('league_id').setDescription('League ID (use /league list)').setRequired(true))
        .addIntegerOption(opt => opt.setName('matchday_id').setDescription('Matchday ID to group this match under').setRequired(true))
        .addStringOption(opt => opt.setName('team_a').setDescription('Team A name').setRequired(true))
        .addStringOption(opt => opt.setName('team_a_emoji').setDescription('Team A emoji').setRequired(true))
        .addStringOption(opt => opt.setName('team_b').setDescription('Team B name').setRequired(true))
        .addStringOption(opt => opt.setName('team_b_emoji').setDescription('Team B emoji').setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post in (overrides league/matchday default)').setRequired(false))
        .addStringOption(opt => opt.setName('date').setDescription('Match date (YYYY-MM-DD HH:MM)').setRequired(false))
    )

    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close voting for a single match')
        .addIntegerOption(opt => opt.setName('match_id').setDescription('Match ID').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List open matches')
        .addIntegerOption(opt => opt.setName('league_id').setDescription('Filter by league ID').setRequired(false))
        .addIntegerOption(opt => opt.setName('matchday_id').setDescription('Filter by matchday ID').setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── CREATE ───────────────────────────────────────────────────────────────
    if (sub === 'create') {
      if (!isModerator(interaction.member)) {
        return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
      }

      const leagueId   = interaction.options.getInteger('league_id');
      const matchdayId = interaction.options.getInteger('matchday_id') ?? null;
      const teamA      = interaction.options.getString('team_a');
      const teamAEmoji = interaction.options.getString('team_a_emoji');
      const teamB      = interaction.options.getString('team_b');
      const teamBEmoji = interaction.options.getString('team_b_emoji');
      const dateStr    = interaction.options.getString('date');
      const channelOpt = interaction.options.getChannel('channel');

      // Validate league
      const [league] = await query('SELECT * FROM leagues WHERE id = ? AND active = true', [leagueId]);
      if (!league) {
        return interaction.reply({ content: `❌ League ID ${leagueId} not found.`, ephemeral: true });
      }

      // Validate matchday if provided
      let matchday = null;
      if (matchdayId) {
        [matchday] = await query('SELECT * FROM matchdays WHERE id = ? AND league_id = ?', [matchdayId, leagueId]);
        if (!matchday) {
          return interaction.reply({ content: `❌ Matchday ID ${matchdayId} not found in this league.`, ephemeral: true });
        }
      }

      // Resolve channel: explicit option > matchday default > league default
      const channelId = channelOpt?.id ?? matchday?.channel_id ?? league.channel_id ?? null;
      if (!channelId) {
        return interaction.reply({
          content: '❌ No channel set. Provide a channel, or set one on the matchday or league.',
          ephemeral: true
        });
      }

      const matchDate = dateStr ? new Date(dateStr) : null;

      // Insert match
      const result = await query(
        `INSERT INTO matches (league_id, matchday_id, team_a, team_a_emoji, team_b, team_b_emoji, match_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [leagueId, matchdayId, teamA, teamAEmoji, teamB, teamBEmoji, matchDate]
      );
      const matchId = result.insertId;
      const [match] = await query('SELECT * FROM matches WHERE id = ?', [matchId]);

      const embedLeague = { ...league, matchday };
      const channel = await interaction.client.channels.fetch(channelId);
      const embed   = buildMatchEmbed(match, embedLeague);
      const msg     = await channel.send({ embeds: [embed] });

      await msg.react(parseEmoji(teamAEmoji));
      await msg.react(parseEmoji(teamBEmoji));

      await query(
        'UPDATE matches SET discord_message_id = ?, discord_channel_id = ? WHERE id = ?',
        [msg.id, channel.id, matchId]
      );

      const matchdayInfo = matchday ? ` (${matchday.label})` : '';
      return interaction.reply({
        content: `✅ Match **${teamA} vs ${teamB}** posted to ${channel}${matchdayInfo} (Match ID: \`${matchId}\`)`,
        ephemeral: true
      });
    }

    // ── CLOSE ────────────────────────────────────────────────────────────────
    if (sub === 'close') {
      if (!isModerator(interaction.member)) {
        return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
      }

      const matchId = interaction.options.getInteger('match_id');
      const [match] = await query('SELECT * FROM matches WHERE id = ?', [matchId]);

      if (!match) return interaction.reply({ content: `❌ Match ID ${matchId} not found.`, ephemeral: true });
      if (match.status !== 'open') return interaction.reply({ content: `❌ Match is already ${match.status}.`, ephemeral: true });

      await query('UPDATE matches SET status = ? WHERE id = ?', ['closed', matchId]);

      try {
        const channel = await interaction.client.channels.fetch(match.discord_channel_id);
        const msg     = await channel.messages.fetch(match.discord_message_id);
        const updated = EmbedBuilder.from(msg.embeds[0])
          .setFooter({ text: `Match ID: ${matchId} • 🔒 Voting is closed` });
        await msg.edit({ embeds: [updated] });
      } catch (e) {
        console.warn('Could not update match message:', e.message);
      }

      const [voteCount] = await query('SELECT COUNT(*) AS c FROM votes WHERE match_id = ?', [matchId]);
      return interaction.reply({
        content: `🔒 Voting closed for match \`${matchId}\`. Total votes: **${voteCount.c}**. Use \`/evaluate\` to set the winner.`,
        ephemeral: true
      });
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const leagueId   = interaction.options.getInteger('league_id');
      const matchdayId = interaction.options.getInteger('matchday_id');

      let sql = `
        SELECT m.*, l.name AS league_name, l.emoji AS league_emoji,
               md.label AS matchday_label, md.number AS matchday_number
        FROM matches m
        JOIN leagues l ON m.league_id = l.id
        LEFT JOIN matchdays md ON m.matchday_id = md.id
        WHERE m.status = 'open'
      `;
      const params = [];

      if (leagueId)   { sql += ' AND m.league_id = ?';   params.push(leagueId); }
      if (matchdayId) { sql += ' AND m.matchday_id = ?'; params.push(matchdayId); }

      sql += ' ORDER BY l.id, md.number, m.match_date';

      const matches = await query(sql, params);

      if (!matches.length) {
        return interaction.reply({ content: 'No open matches found.', ephemeral: true });
      }

      const lines = matches.map(m => {
        const day = m.matchday_label ? ` [${m.matchday_label}]` : '';
        return (
          `\`ID:${m.id}\` ${m.league_emoji}${day} **${m.team_a_emoji} ${m.team_a} vs ${m.team_b} ${m.team_b_emoji}**` +
          (m.match_date ? ` — <t:${Math.floor(new Date(m.match_date).getTime() / 1000)}:f>` : '')
        );
      });

      const embed = new EmbedBuilder()
        .setTitle('📋 Open Matches')
        .setColor(0x3498db)
        .setDescription(lines.join('\n'));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
