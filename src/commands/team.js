const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ComponentType
} = require('discord.js');
const { query } = require('../db/database');
const { isModerator } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Manage teams (mod only)')

    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a team to a league')
        .addIntegerOption(opt => opt.setName('league_id').setDescription('League ID').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('Team name').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('Team emoji').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove (deactivate) a team from a league')
        .addIntegerOption(opt => opt.setName('league_id').setDescription('League ID').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('move')
        .setDescription('Move a team to a different league (promotion / relegation)')
        .addIntegerOption(opt => opt.setName('from_league_id').setDescription('Current league ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('to_league_id').setDescription('Target league ID').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all teams in a league')
        .addIntegerOption(opt => opt.setName('league_id').setDescription('League ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── ADD ──────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      if (!isModerator(interaction.member)) {
        return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
      }

      const leagueId = interaction.options.getInteger('league_id');
      const name     = interaction.options.getString('name').trim();
      const emoji    = interaction.options.getString('emoji').trim();

      const [league] = await query('SELECT * FROM leagues WHERE id = ? AND active = true', [leagueId]);
      if (!league) {
        return interaction.reply({ content: `❌ League ID ${leagueId} not found.`, ephemeral: true });
      }

      // Check for duplicate name in this league
      const [existing] = await query(
        'SELECT * FROM teams WHERE name = ? AND league_id = ? AND active = true',
        [name, leagueId]
      );
      if (existing) {
        return interaction.reply({
          content: `❌ **${name}** already exists in ${league.emoji} ${league.name}.`,
          ephemeral: true
        });
      }

      const result = await query(
        'INSERT INTO teams (name, league_id, emoji) VALUES (?, ?, ?)',
        [name, leagueId, emoji]
      );

      return interaction.reply({
        content: `✅ **${emoji} ${name}** added to ${league.emoji} ${league.name}! (Team ID: \`${result.insertId}\`)`,
        ephemeral: true
      });
    }

    // ── REMOVE ───────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      if (!isModerator(interaction.member)) {
        return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
      }

      const leagueId = interaction.options.getInteger('league_id');

      const [league] = await query('SELECT * FROM leagues WHERE id = ?', [leagueId]);
      if (!league) {
        return interaction.reply({ content: `❌ League ID ${leagueId} not found.`, ephemeral: true });
      }

      const teams = await query(
        'SELECT * FROM teams WHERE league_id = ? AND active = true ORDER BY name',
        [leagueId]
      );
      if (!teams.length) {
        return interaction.reply({ content: `No active teams in **${league.name}**.`, ephemeral: true });
      }

      // Show dropdown of teams to remove
      const select = new StringSelectMenuBuilder()
        .setCustomId('remove_team_select')
        .setPlaceholder('Select team to remove...')
        .addOptions(
          teams.map(t =>
            new StringSelectMenuOptionBuilder()
              .setLabel(t.name)
              .setDescription(`ID: ${t.team_id}`)
              .setValue(String(t.team_id))
              .setEmoji(parseEmojiForMenu(t.emoji))
          )
        );

      await interaction.reply({
        content: `## ❌ Remove Team — ${league.emoji} ${league.name}\nSelect the team to deactivate:`,
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });

      try {
        const sel = await interaction.channel.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          filter: i => i.customId === 'remove_team_select' && i.user.id === interaction.user.id,
          time: 60_000
        });

        const teamId = parseInt(sel.values[0]);
        const team   = teams.find(t => t.team_id === teamId);

        await query('UPDATE teams SET active = false WHERE team_id = ?', [teamId]);

        return sel.update({
          content: `✅ **${team.emoji} ${team.name}** has been deactivated from ${league.emoji} ${league.name}.`,
          components: []
        });
      } catch {
        return interaction.editReply({ content: '⏱️ Timed out.', components: [] });
      }
    }

    // ── MOVE (promotion / relegation) ────────────────────────────────────────
    if (sub === 'move') {
      if (!isModerator(interaction.member)) {
        return interaction.reply({ content: '🚫 You need the moderator role to use this.', ephemeral: true });
      }

      const fromLeagueId = interaction.options.getInteger('from_league_id');
      const toLeagueId   = interaction.options.getInteger('to_league_id');

      const [fromLeague] = await query('SELECT * FROM leagues WHERE id = ?', [fromLeagueId]);
      const [toLeague]   = await query('SELECT * FROM leagues WHERE id = ?', [toLeagueId]);

      if (!fromLeague) return interaction.reply({ content: `❌ From-league ID ${fromLeagueId} not found.`, ephemeral: true });
      if (!toLeague)   return interaction.reply({ content: `❌ To-league ID ${toLeagueId} not found.`, ephemeral: true });
      if (fromLeagueId === toLeagueId) return interaction.reply({ content: `❌ From and to leagues must be different.`, ephemeral: true });

      const teams = await query(
        'SELECT * FROM teams WHERE league_id = ? AND active = true ORDER BY name',
        [fromLeagueId]
      );
      if (!teams.length) {
        return interaction.reply({ content: `No active teams in **${fromLeague.name}**.`, ephemeral: true });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId('move_team_select')
        .setPlaceholder('Select team to move...')
        .addOptions(
          teams.map(t =>
            new StringSelectMenuOptionBuilder()
              .setLabel(t.name)
              .setDescription(`ID: ${t.team_id}`)
              .setValue(String(t.team_id))
              .setEmoji(parseEmojiForMenu(t.emoji))
          )
        );

      await interaction.reply({
        content:
          `## 🔀 Move Team\n` +
          `**From:** ${fromLeague.emoji} ${fromLeague.name}\n` +
          `**To:** ${toLeague.emoji} ${toLeague.name}\n\n` +
          `Select the team to move:`,
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });

      try {
        const sel = await interaction.channel.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          filter: i => i.customId === 'move_team_select' && i.user.id === interaction.user.id,
          time: 60_000
        });

        const teamId = parseInt(sel.values[0]);
        const team   = teams.find(t => t.team_id === teamId);

        // Check the team doesn't already exist in the target league
        const [duplicate] = await query(
          'SELECT * FROM teams WHERE name = ? AND league_id = ? AND active = true',
          [team.name, toLeagueId]
        );
        if (duplicate) {
          return sel.update({
            content: `❌ **${team.name}** already exists in ${toLeague.emoji} ${toLeague.name}.`,
            components: []
          });
        }

        await query('UPDATE teams SET league_id = ? WHERE team_id = ?', [toLeagueId, teamId]);

        return sel.update({
          content:
            `✅ **${team.emoji} ${team.name}** moved from ${fromLeague.emoji} ${fromLeague.name} → ${toLeague.emoji} ${toLeague.name}!`,
          components: []
        });
      } catch {
        return interaction.editReply({ content: '⏱️ Timed out.', components: [] });
      }
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const leagueId = interaction.options.getInteger('league_id');

      const [league] = await query('SELECT * FROM leagues WHERE id = ?', [leagueId]);
      if (!league) {
        return interaction.reply({ content: `❌ League ID ${leagueId} not found.`, ephemeral: true });
      }

      const teams = await query(
        'SELECT * FROM teams WHERE league_id = ? ORDER BY active DESC, name',
        [leagueId]
      );

      if (!teams.length) {
        return interaction.reply({ content: `No teams found in **${league.name}**.`, ephemeral: true });
      }

      const active   = teams.filter(t => t.active);
      const inactive = teams.filter(t => !t.active);

      let description = active.map(t => `${t.emoji} **${t.name}** \`ID:${t.team_id}\``).join('\n');
      if (inactive.length) {
        description += `\n\n**Inactive:**\n` + inactive.map(t => `~~${t.emoji} ${t.name}~~`).join('\n');
      }

      const embed = new EmbedBuilder()
        .setTitle(`${league.emoji} ${league.name} — Teams (${active.length} active)`)
        .setColor(0x2ecc71)
        .setDescription(description);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};

// Converts stored emoji string to a format Discord's menu builder accepts
function parseEmojiForMenu(emoji) {
  const match = emoji.match(/^<a?:(\w+):(\d+)>$/);
  if (match) return { id: match[2], name: match[1] };
  return { name: emoji }; // unicode
}
