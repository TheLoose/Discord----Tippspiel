const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  EmbedBuilder
} = require('discord.js');
const { query } = require('../db/database');
const { isModerator, buildMatchEmbed, parseEmoji } = require('../utils/helpers');

// Converts stored emoji string to a format Discord's menu builder accepts
function parseEmojiForMenu(emoji) {
  const match = emoji.match(/^<a?:(\w+):(\d+)>$/);
  if (match) return { id: match[2], name: match[1] };
  return { name: emoji };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('match2')
    .setDescription('Manage matches with interactive menus (mod only)')

    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Post a new match prediction using dropdowns')
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

    // ── CREATE FLOW ──────────────────────────────────────────────────────────
    if (sub === 'create') {
  if (!isModerator(interaction.member)) {
    return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
  }

  // ── Step 1: League select ──────────────────────────────────────────────
  const leagues = await query('SELECT * FROM leagues WHERE active = true ORDER BY name');
    console.log('DEBUG: leagues fetched:', leagues.length);
      if (!leagues.length) {
        return interaction.reply({ content: '❌ No active leagues found. Create one with `/league create`.', ephemeral: true });
      }

      const leagueSelect = new StringSelectMenuBuilder()
        .setCustomId('select_league')
        .setPlaceholder('Select a league...')
        .addOptions(
          leagues.map(l =>
            new StringSelectMenuOptionBuilder()
              .setLabel(l.name)
              .setDescription(`ID: ${l.id}`)
              .setValue(String(l.id))
              .setEmoji(parseEmojiForMenu(l.emoji ?? '🏆'))
          )
        );

      await interaction.reply({
        content: '## 📋 New Match — Step 1 of 4\nSelect the league:',
        components: [new ActionRowBuilder().addComponents(leagueSelect)],
        ephemeral: true
      });

      // ── Step 2: Matchday select ────────────────────────────────────────────
      let leagueId, league;
      try {
        const leagueInteraction = await interaction.channel.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          filter: i => i.customId === 'select_league' && i.user.id === interaction.user.id,
          time: 60_000
        });

        leagueId = parseInt(leagueInteraction.values[0]);
        league   = leagues.find(l => l.id === leagueId);

        const matchdays = await query(
          `SELECT * FROM matchdays WHERE league_id = ? AND status != 'evaluated' ORDER BY number`,
          [leagueId]
        );
        if (!matchdays.length) {
          await leagueInteraction.update({
            content: `❌ No active matchdays for **${league.emoji} ${league.name}**. Create one with \`/matchday create\`.`,
            components: []
          });
          return;
        }

        const matchdaySelect = new StringSelectMenuBuilder()
          .setCustomId('select_matchday')
          .setPlaceholder('Select a matchday...')
          .addOptions(
            matchdays.map(md =>
              new StringSelectMenuOptionBuilder()
                .setLabel(md.label)
                .setDescription(`ID: ${md.id} • ${md.status}`)
                .setValue(String(md.id))
            )
          );

        await leagueInteraction.update({
          content: `## 📋 New Match — Step 2 of 4\n**League:** ${league.emoji} ${league.name}\nSelect the matchday:`,
          components: [new ActionRowBuilder().addComponents(matchdaySelect)]
        });
      } catch {
        return interaction.editReply({ content: '⏱️ Timed out. Run `/match2 create` again.', components: [] });
      }

      // ── Step 3: Team A + Team B selects ───────────────────────────────────
      let matchdayId, matchday;
      try {
        const matchdayInteraction = await interaction.channel.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          filter: i => i.customId === 'select_matchday' && i.user.id === interaction.user.id,
          time: 60_000
        });

        matchdayId = parseInt(matchdayInteraction.values[0]);
        const allMatchdays = await query('SELECT * FROM matchdays WHERE league_id = ?', [leagueId]);
        matchday = allMatchdays.find(md => md.id === matchdayId);

        // Load teams for this league
        const teams = await query(
          'SELECT * FROM teams WHERE league_id = ? AND active = true ORDER BY name',
          [leagueId]
        );
        if (teams.length < 2) {
          await matchdayInteraction.update({
            content: `❌ Not enough teams in **${league.name}**. Add at least 2 with \`/team add\`.`,
            components: []
          });
          return;
        }

        const teamOptions = teams.map(t =>
          new StringSelectMenuOptionBuilder()
            .setLabel(t.name)
            .setDescription(`ID: ${t.team_id}`)
            .setValue(String(t.team_id))
            .setEmoji(parseEmojiForMenu(t.emoji))
        );

        const teamASelect = new StringSelectMenuBuilder()
          .setCustomId('select_team_a')
          .setPlaceholder('Select Team A (home)...')
          .addOptions(teamOptions);

        const teamBSelect = new StringSelectMenuBuilder()
          .setCustomId('select_team_b')
          .setPlaceholder('Select Team B (away)...')
          .addOptions(teamOptions);

        await matchdayInteraction.update({
          content:
            `## 📋 New Match — Step 3 of 4\n` +
            `**League:** ${league.emoji} ${league.name}\n` +
            `**Matchday:** ${matchday.label}\n\n` +
            `Select both teams — first Team A (home), then Team B (away):`,
          components: [
            new ActionRowBuilder().addComponents(teamASelect),
            new ActionRowBuilder().addComponents(teamBSelect)
          ]
        });

        // Wait for both team selections (can come in any order)
        let teamAId = null, teamBId = null;

        // Collect two selections
        for (let i = 0; i < 2; i++) {
          const sel = await interaction.channel.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            filter: i =>
              (i.customId === 'select_team_a' || i.customId === 'select_team_b') &&
              i.user.id === interaction.user.id,
            time: 60_000
          });
          await sel.deferUpdate();
          if (sel.customId === 'select_team_a') teamAId = parseInt(sel.values[0]);
          if (sel.customId === 'select_team_b') teamBId = parseInt(sel.values[0]);
        }

        if (teamAId === teamBId) {
          return interaction.editReply({ content: '❌ Team A and Team B must be different.', components: [] });
        }

        const teamA = teams.find(t => t.team_id === teamAId);
        const teamB = teams.find(t => t.team_id === teamBId);

        // ── Step 4: Optional date via modal ───────────────────────────────────
        const confirmBtn = new ButtonBuilder()
          .setCustomId('open_date_modal')
          .setLabel(`Post: ${teamA.name} vs ${teamB.name}`)
          .setStyle(ButtonStyle.Success);

        const skipBtn = new ButtonBuilder()
          .setCustomId('skip_date')
          .setLabel('Post without date')
          .setStyle(ButtonStyle.Secondary);

        await interaction.editReply({
          content:
            `## 📋 New Match — Step 4 of 4\n` +
            `**${teamA.emoji} ${teamA.name}** vs **${teamB.name} ${teamB.emoji}**\n\n` +
            `Add a match date, or post right away:`,
          components: [new ActionRowBuilder().addComponents(confirmBtn, skipBtn)]
        });

        let matchDate = null;

        const btnInteraction = await interaction.channel.awaitMessageComponent({
          componentType: ComponentType.Button,
          filter: i => (i.customId === 'open_date_modal' || i.customId === 'skip_date') && i.user.id === interaction.user.id,
          time: 60_000
        });

        if (btnInteraction.customId === 'open_date_modal') {
          // Retry loop — keeps showing the modal until a valid date is entered
          let lastError = null;
          let currentBtnInteraction = btnInteraction;

          while (true) {
            const modal = new ModalBuilder()
              .setCustomId('date_modal')
              .setTitle(lastError ? '⚠️ Invalid date — try again' : 'Match Date');

            modal.addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('match_date')
                  .setLabel('Date & time (YYYY-MM-DD HH:MM)')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('e.g. 2026-05-10 18:30')
                  .setValue(lastError ?? '')   // pre-fill with what they typed last time
                  .setRequired(true)
              )
            );

            await currentBtnInteraction.showModal(modal);

            const modalSubmit = await currentBtnInteraction.awaitModalSubmit({
              filter: i => i.customId === 'date_modal' && i.user.id === interaction.user.id,
              time: 120_000
            });

            const dateStr = modalSubmit.fields.getTextInputValue('match_date').trim();
            const parsed  = new Date(dateStr);

            // Validate: must be a real date and not in the past
            if (isNaN(parsed.getTime())) {
              // Invalid format — show an error message and a retry button, then loop
              lastError = dateStr;
              const retryBtn = new ButtonBuilder()
                .setCustomId('open_date_modal')
                .setLabel('Fix date')
                .setStyle(ButtonStyle.Danger);
              const skipBtn2 = new ButtonBuilder()
                .setCustomId('skip_date')
                .setLabel('Post without date')
                .setStyle(ButtonStyle.Secondary);

              await modalSubmit.update({
                content:
                  `## 📋 New Match — Step 4 of 4\n` +
                  `**${teamA.emoji} ${teamA.name}** vs **${teamB.name} ${teamB.emoji}**\n\n` +
                  `❌ **"${dateStr}"** is not a valid date.\n` +
                  `Please use the format \`YYYY-MM-DD HH:MM\` (e.g. \`2026-05-10 18:30\`)`,
                components: [new ActionRowBuilder().addComponents(retryBtn, skipBtn2)]
              });

              // Wait for them to click retry or skip
              const nextBtn = await interaction.channel.awaitMessageComponent({
                componentType: ComponentType.Button,
                filter: i => (i.customId === 'open_date_modal' || i.customId === 'skip_date') && i.user.id === interaction.user.id,
                time: 120_000
              });

              if (nextBtn.customId === 'skip_date') {
                await nextBtn.deferUpdate();
                matchDate = null;
                break;
              }

              currentBtnInteraction = nextBtn;
              continue;
            }

            // Valid date — accept it
            matchDate = parsed;
            await modalSubmit.deferUpdate();
            break;
          }
        } else {
          await btnInteraction.deferUpdate();
        }

        // ── Post the match ─────────────────────────────────────────────────────
        const channelId = matchday.channel_id ?? league.channel_id ?? null;
        if (!channelId) {
          return interaction.editReply({
            content: '❌ No channel set on this matchday or league. Set one with `/matchday create channel:#your-channel`.',
            components: []
          });
        }

        // Decide whether to post now or schedule for midnight:
        // - No date → post immediately
        // - Date is today → post immediately (voting closes at kickoff via cron)
        // - Date is a future day → save as 'scheduled', post at midnight that day
        const tz = process.env.TIMEZONE ?? 'Europe/Berlin';
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
        const todayStr = now.toDateString();
        const matchDateLocal = matchDate
          ? new Date(matchDate.toLocaleString('en-US', { timeZone: tz }))
          : null;
        const isToday = matchDateLocal && matchDateLocal.toDateString() === todayStr;
        const isFuture = matchDateLocal && matchDateLocal.toDateString() !== todayStr && matchDate > now;

        const initialStatus = isFuture ? 'scheduled' : 'open';

        const result = await query(
          `INSERT INTO matches (league_id, matchday_id, team_a_id, team_b_id, match_date, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [leagueId, matchdayId, teamAId, teamBId, matchDate, initialStatus]
        );
        const matchId = result.insertId;

        if (initialStatus === 'scheduled') {
          // Future match — will be posted at midnight on match day
          const dateFormatted = matchDate.toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: tz
          });
          return interaction.editReply({
            content:
              `✅ **${teamA.emoji} ${teamA.name} vs ${teamB.name} ${teamB.emoji}** scheduled!\n` +
              `📅 Kickoff: **${dateFormatted}**\n` +
              `📢 Will be posted to <#${channelId}> at midnight on match day.\n` +
              `🔒 Voting will close automatically at kickoff time.\n` +
              `League: ${league.emoji} ${league.name} — ${matchday.label} (Match ID: \`${matchId}\`)`,
            components: []
          });
        }

        // Post immediately (no date, or match is today)
        const matchForEmbed = {
          id:           matchId,
          team_a:       teamA.name,
          team_a_emoji: teamA.emoji,
          team_b:       teamB.name,
          team_b_emoji: teamB.emoji,
          match_date:   matchDate
        };

        const embedLeague = { ...league, matchday };
        const channel     = await interaction.client.channels.fetch(channelId);
        const embed       = buildMatchEmbed(matchForEmbed, embedLeague);
        const msg         = await channel.send({ embeds: [embed] });

        await msg.react(parseEmoji(teamA.emoji));
        await msg.react(parseEmoji(teamB.emoji));

        await query(
          'UPDATE matches SET discord_message_id = ?, discord_channel_id = ? WHERE id = ?',
          [msg.id, channel.id, matchId]
        );

        return interaction.editReply({
          content:
            `✅ **${teamA.emoji} ${teamA.name} vs ${teamB.name} ${teamB.emoji}** posted!\n` +
            `League: ${league.emoji} ${league.name} — ${matchday.label} (Match ID: \`${matchId}\`)`,
          components: []
        });

      } catch (e) {
        console.error(e);
        return interaction.editReply({ content: '⏱️ Timed out or something went wrong. Run `/match2 create` again.', components: [] });
      }
    }

    // ── CLOSE ────────────────────────────────────────────────────────────────
    if (sub === 'close') {
      if (!isModerator(interaction.member)) {
        return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
      }

      const matchId = interaction.options.getInteger('match_id');
      const [match] = await query(
        `SELECT m.*, t1.name AS team_a, t1.emoji AS team_a_emoji,
                       t2.name AS team_b, t2.emoji AS team_b_emoji
         FROM matches m
         JOIN teams t1 ON m.team_a_id = t1.team_id
         JOIN teams t2 ON m.team_b_id = t2.team_id
         WHERE m.id = ?`,
        [matchId]
      );

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
        content: `🔒 Voting closed for match \`${matchId}\`. Total votes: **${voteCount.c}**.`,
        ephemeral: true
      });
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const leagueId   = interaction.options.getInteger('league_id');
      const matchdayId = interaction.options.getInteger('matchday_id');

      let sql = `
        SELECT m.id, m.status, m.match_date,
               t1.name AS team_a, t1.emoji AS team_a_emoji,
               t2.name AS team_b, t2.emoji AS team_b_emoji,
               l.name AS league_name, l.emoji AS league_emoji,
               md.label AS matchday_label
        FROM matches m
        JOIN teams t1 ON m.team_a_id = t1.team_id
        JOIN teams t2 ON m.team_b_id = t2.team_id
        JOIN leagues l ON m.league_id = l.id
        LEFT JOIN matchdays md ON m.matchday_id = md.id
        WHERE m.status IN ('open', 'scheduled')
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
        return `\`ID:${m.id}\` ${m.league_emoji}${day} **${m.team_a_emoji} ${m.team_a} vs ${m.team_b} ${m.team_b_emoji}**`;
      });

      const embed = new EmbedBuilder()
        .setTitle('📋 Open Matches')
        .setColor(0x3498db)
        .setDescription(lines.join('\n'));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};