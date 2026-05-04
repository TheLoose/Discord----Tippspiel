require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  // Temporarily mock dependencies so we can extract just the slash command data
  const Module = require('module');
  const originalLoad = Module._load;
  Module._load = function(request, ...args) {
    if (request.includes('database') || request.includes('helpers')) {
      return {
        query: () => {},
        initDB: () => {},
        buildMatchEmbed: () => {},
        buildResultEmbed: () => {},
        isModerator: () => {}
      };
    }
    return originalLoad.apply(this, [request, ...args]);
  };

  const command = require(path.join(commandsPath, file));
  Module._load = originalLoad; // restore
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered successfully!');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
})();