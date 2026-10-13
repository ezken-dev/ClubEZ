import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
const commandFolders = ['moderation', 'leveling', 'utility', 'templates'];

for (const folder of commandFolders) {
  const folderPath = path.join(__dirname, 'commands', folder);
  if (!fs.existsSync(folderPath)) continue;

  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const commandModule = await import(`file://${filePath}`);
    const command = commandModule.default || commandModule;
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      console.log(`[DEPLOY] Loaded /${command.data.name} from commands/${folder}/${file}`);
    } else {
      console.warn(`[DEPLOY WARNING] Command at ${filePath} is missing "data" or "execute".`);
    }
  }
}

if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN and DISCORD_CLIENT_ID must be specified in .env to deploy commands.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);

(async () => {
  try {
    console.log(`🚀 Refreshing ${commands.length} application (/) commands for Club EZKEN...`);

    if (CONFIG.GUILD_ID) {
      // Guild-specific registration (instant updates during development / server launch)
      const data = await rest.put(
        Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Successfully registered ${data.length} guild slash commands in guild ${CONFIG.GUILD_ID}.`);
    } else {
      // Global registration (can take up to 1 hour to propagate worldwide)
      const data = await rest.put(
        Routes.applicationCommands(CONFIG.CLIENT_ID),
        { body: commands }
      );
      console.log(`✅ Successfully registered ${data.length} global slash commands.`);
    }
  } catch (error) {
    console.error('❌ Failed to deploy slash commands:', error);
  }
})();
