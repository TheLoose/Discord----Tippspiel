const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { query } = require('../db/database');
const { isModerator, buildResultEmbed } = require('../utils/helpers');

// ── Shared evaluation logic (also used by /evaluate) ─────────────────────────
async function evaluateMatch(client, match, winnerSide) {
  const votes = await query('SELECT * FROM votes WHERE match_id = ?', [match.id]);

  let correct = 0;
  let wrong   = 0;

  for (const vote of votes) {
    const isCorrect = vote.team === winnerSide;
    if (isCorrect) correct++; else wrong++;

    await query(
      `INSERT INTO points (user_id, league_id, username, total, correct, total_votes)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         username    = VALUES(username),
         total       = total + VALUES(total),
         correct     = correct + VALUES(correct),
         total_votes = total_votes + 1`,
      [vote.user_id, match.league_id, vote.username, isCorrect ? 1 : 0, isCorrect ? 1 : 0]
    );
  }

  await query(
    'UPDATE matches SET status = ?, winning_team = ? WHERE id = ?',
    ['evaluated', winnerSide, match.id]
  );

  try {
    const league = { id: match.league_id, name: match.league_name, emoji: match.league_emoji };
    const winnerName  = winnerSide === 'a' ? match.team_a  : match.team_b;
    const winnerEmoji = winnerSide === 'a' ? match.team_a_emoji : match.team_b_emoji;
    const embed = buildResultEmbed(match, league, winnerName, winnerEmoji, { correct, wrong, noVote: 0 });
    const channel = await client.channels.fetch(match.discord_channel_id);
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.warn('Could not post result embed:', e.message);
  }

  return { correct, wrong };
}

// Converts stored emoji string to format for button emoji field
function parseEmojiForButton(emoji) {
  const match = emoji.match(/^<a?:(\w+):(\d+)>$/);
  if (match) return { id: match[2], name: match[1] };
  return { name: emoji };
}

module.exports = {
  evaluateMatch,

  data: new SlashCommandBuilder()
    .setName('matchday')
    .setDescription('Manage matchdays (mod only)')

    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new matchday for a league')
        .addIntegerOption(opt => opt.setName('league_id').setDescription('League ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('number').setDescription('Matchday number (e.g. 28)').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('Optional label').setRequired(false))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post matches in').setRequired(false))
    )

    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List matchdays for a league')
        .addIntegerOption(opt => opt.setName('league_id').setDescription('League ID').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close voting for all matches in a matchday')
        .addIntegerOption(opt => opt.setName('matchday_id').setDescription('Matchday ID').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('evaluate')
        .setDescription('Evaluate all matches in a matchday with interactive buttons')
        .addIntegerOption(opt => opt.setName('matchday_id').setDescription('Matchday ID').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('summary')
        .setDescription('Show all matches and vote counts for a matchday')
        .addIntegerOption(opt => opt.setName('matchday_id').setDescription('Matchday ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── CREATE ───────────────────────────────────────────────────────────────
    if (sub === 'create') {
      if (!isModerator(interaction.member)) {
        return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
      }

      const leagueId = interaction.options.getInteger('league_id');
      const number   = interaction.options.getInteger('number');
      const label    = interaction.options.getString('label') ?? `Matchday ${number}`;
      const channel  = interaction.options.getChannel('channel');

      const [league] = await query('SELECT * FROM leagues WHERE id = ? AND active = true', [leagueId]);
      if (!league) {
        return interaction.reply({ content: `❌ League ID ${leagueId} not found.`, ephemeral: true });
      }

      const channelId = channel?.id ?? league.channel_id ?? null;

      try {
        const result = await query(
          'INSERT INTO matchdays (league_id, number, label, channel_id) VALUES (?, ?, ?, ?)',
          [leagueId, number, label, channelId]
        );
        const channelMention = channelId ? `<#${channelId}>` : 'no default channel set';
        return interaction.reply({
          content: `✅ **${league.emoji} ${league.name} — ${label}** created! (ID: \`${result.insertId}\`)\nMatches will post to ${channelMention}.`,
          ephemeral: true
        });
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          return interaction.reply({ content: `❌ Matchday ${number} already exists for this league.`, ephemeral: true });
        }
        throw e;
      }
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const leagueId = interaction.options.getInteger('league_id');

      const [league] = await query('SELECT * FROM leagues WHERE id = ?', [leagueId]);
      if (!league) {
        return interaction.reply({ content: `❌ League ID ${leagueId} not found.`, ephemeral: true });
      }

      const matchdays = await query(
        `SELECT md.*,
                COUNT(m.id) AS match_count,
                SUM(CASE WHEN m.status = 'evaluated' THEN 1 ELSE 0 END) AS evaluated_count
         FROM matchdays md
         LEFT JOIN matches m ON m.matchday_id = md.id
         WHERE md.league_id = ?
         GROUP BY md.id
         ORDER BY md.number`,
        [leagueId]
      );

      if (!matchdays.length) {
        return interaction.reply({ content: `No matchdays found for **${league.name}**.`, ephemeral: true });
      }

      const statusEmoji = { open: '🟢', closed: '🔒', evaluated: '✅' };
      const lines = matchdays.map(md =>
        `${statusEmoji[md.status] ?? '⚪'} \`ID:${md.id}\` **${md.label}** — ${md.match_count} matches (${md.evaluated_count} evaluated)`
      );

      const embed = new EmbedBuilder()
        .setTitle(`${league.emoji} ${league.name} — Matchdays`)
        .setColor(0x3498db)
        .setDescription(lines.join('\n'));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── CLOSE ────────────────────────────────────────────────────────────────
    if (sub === 'close') {
      if (!isModerator(interaction.member)) {
        return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
      }

      const matchdayId = interaction.options.getInteger('matchday_id');
      const [matchday] = await query('SELECT * FROM matchdays WHERE id = ?', [matchdayId]);

      if (!matchday) {
        return interaction.reply({ content: `❌ Matchday ID ${matchdayId} not found.`, ephemeral: true });
      }

      const result = await query(
        `UPDATE matches SET status = 'closed' WHERE matchday_id = ? AND status = 'open'`,
        [matchdayId]
      );
      await query(`UPDATE matchdays SET status = 'closed' WHERE id = ?`, [matchdayId]);

      return interaction.reply({
        content: `🔒 **${matchday.label}** closed — ${result.affectedRows} match(es) locked for voting.`,
        ephemeral: true
      });
    }

    // ── EVALUATE ─────────────────────────────────────────────────────────────
    if (sub === 'evaluate') {
      if (!isModerator(interaction.member)) {
        return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
      }

      const matchdayId = interaction.options.getInteger('matchday_id');

      const [matchday] = await query(
        `SELECT md.*, l.name AS league_name, l.emoji AS league_emoji
         FROM matchdays md JOIN leagues l ON md.league_id = l.id
         WHERE md.id = ?`,
        [matchdayId]
      );

      if (!matchday) {
        return interaction.reply({ content: `❌ Matchday ID ${matchdayId} not found.`, ephemeral: true });
      }

      // Join teams so we have names + emojis
      const matches = await query(
        `SELECT m.*,
                l.name AS league_name, l.emoji AS league_emoji,
                t1.name AS team_a, t1.emoji AS team_a_emoji,
                t2.name AS team_b, t2.emoji AS team_b_emoji
         FROM matches m
         JOIN leagues l  ON m.league_id  = l.id
         JOIN teams   t1 ON m.team_a_id  = t1.team_id
         JOIN teams   t2 ON m.team_b_id  = t2.team_id
         WHERE m.matchday_id = ? AND m.status = 'closed'
         ORDER BY m.id`,
        [matchdayId]
      );

      if (!matches.length) {
        return interaction.reply({
          content: `⚠️ No closed matches found in **${matchday.label}**.\nClose the matchday first with \`/matchday close\`.`,
          ephemeral: true
        });
      }

      await interaction.reply({
        content: `## ${matchday.league_emoji} ${matchday.league_name} — ${matchday.label}\nEvaluating **${matches.length}** match(es). Pick the winner for each:`,
        ephemeral: true
      });

      let evaluated = 0;
      let skipped   = 0;

      for (const match of matches) {
        const [votesA] = await query(
          `SELECT COUNT(*) AS c FROM votes WHERE match_id = ? AND team = 'a'`, [match.id]
        );
        const [votesB] = await query(
          `SELECT COUNT(*) AS c FROM votes WHERE match_id = ? AND team = 'b'`, [match.id]
        );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`eval_a_${match.id}`)
            .setLabel(`${match.team_a} (${votesA.c} votes)`)
            .setEmoji(parseEmojiForButton(match.team_a_emoji))
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`eval_b_${match.id}`)
            .setLabel(`${match.team_b} (${votesB.c} votes)`)
            .setEmoji(parseEmojiForButton(match.team_b_emoji))
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`eval_skip_${match.id}`)
            .setLabel('Skip')
            .setStyle(ButtonStyle.Secondary)
        );

        const prompt = await interaction.followUp({
          content:
            `**Match \`ID:${match.id}\`** — ${match.team_a_emoji} **${match.team_a}** vs **${match.team_b}** ${match.team_b_emoji}\n` +
            `Votes: ${match.team_a_emoji} ${votesA.c} — ${match.team_b_emoji} ${votesB.c}\n` +
            `Who won?`,
          components: [row],
          ephemeral: true
        });

        try {
          const btn = await prompt.awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: i => i.user.id === interaction.user.id,
            time: 60_000
          });

          await btn.deferUpdate();

          if (btn.customId === `eval_skip_${match.id}`) {
            skipped++;
            await interaction.followUp({ content: `⏭️ Skipped match \`${match.id}\`.`, ephemeral: true });
            continue;
          }

          const winnerSide = btn.customId === `eval_a_${match.id}` ? 'a' : 'b';
          const { correct, wrong } = await evaluateMatch(interaction.client, match, winnerSide);
          const winnerName  = winnerSide === 'a' ? match.team_a  : match.team_b;
          const winnerEmoji = winnerSide === 'a' ? match.team_a_emoji : match.team_b_emoji;
          evaluated++;

          await interaction.followUp({
            content: `✅ Match \`${match.id}\` — 🏅 **${winnerEmoji} ${winnerName}** wins! (${correct} correct, ${wrong} wrong)`,
            ephemeral: true
          });

        } catch {
          await interaction.followUp({
            content: `⏱️ Timed out on match \`${match.id}\`. Run \`/matchday evaluate\` again to continue.`,
            ephemeral: true
          });
          break;
        }
      }

      if (evaluated + skipped === matches.length && skipped === 0) {
        await query(`UPDATE matchdays SET status = 'evaluated' WHERE id = ?`, [matchdayId]);
      }

      return interaction.followUp({
        content: `🏁 Done! **${evaluated}** evaluated, **${skipped}** skipped.`,
        ephemeral: true
      });
    }

    // ── SUMMARY ──────────────────────────────────────────────────────────────
    if (sub === 'summary') {
      const matchdayId = interaction.options.getInteger('matchday_id');

      const [matchday] = await query(
        `SELECT md.*, l.name AS league_name, l.emoji AS league_emoji
         FROM matchdays md JOIN leagues l ON md.league_id = l.id
         WHERE md.id = ?`,
        [matchdayId]
      );

      if (!matchday) {
        return interaction.reply({ content: `❌ Matchday ID ${matchdayId} not found.`, ephemeral: true });
      }

      const matches = await query(
        `SELECT m.*,
                t1.name AS team_a, t1.emoji AS team_a_emoji,
                t2.name AS team_b, t2.emoji AS team_b_emoji,
                COUNT(v.id) AS total_votes,
                SUM(CASE WHEN v.team = 'a' THEN 1 ELSE 0 END) AS votes_a,
                SUM(CASE WHEN v.team = 'b' THEN 1 ELSE 0 END) AS votes_b
         FROM matches m
         JOIN teams t1 ON m.team_a_id = t1.team_id
         JOIN teams t2 ON m.team_b_id = t2.team_id
         LEFT JOIN votes v ON v.match_id = m.id
         WHERE m.matchday_id = ?
         GROUP BY m.id, t1.name, t1.emoji, t2.name, t2.emoji
         ORDER BY m.match_date`,
        [matchdayId]
      );

      if (!matches.length) {
        return interaction.reply({ content: `No matches found for this matchday.`, ephemeral: true });
      }

      const statusEmoji = { open: '🟢', closed: '🔒', evaluated: '✅' };

      const lines = matches.map(m => {
        const winner = m.winning_team === 'a'
          ? `🏅 ${m.team_a_emoji} ${m.team_a}`
          : m.winning_team === 'b'
          ? `🏅 ${m.team_b_emoji} ${m.team_b}`
          : '';
        return (
          `${statusEmoji[m.status]} \`ID:${m.id}\` ${m.team_a_emoji} **${m.team_a}** vs **${m.team_b}** ${m.team_b_emoji}\n` +
          `↳ Votes: ${m.team_a_emoji} ${m.votes_a ?? 0} — ${m.team_b_emoji} ${m.votes_b ?? 0} (${m.total_votes ?? 0} total)` +
          (winner ? `\n↳ ${winner}` : '')
        );
      });

      const embed = new EmbedBuilder()
        .setTitle(`${matchday.league_emoji} ${matchday.league_name} — ${matchday.label}`)
        .setColor(0x9b59b6)
        .setDescription(lines.join('\n\n'))
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};
