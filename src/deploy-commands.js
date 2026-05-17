import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import { priceCommand } from './commands/price.js';
import { watchCommand } from './commands/watch.js';
import { pingCommand } from './commands/ping.js';
import { setupCommand } from './commands/setup.js';

const commands = [
  priceCommand.data.toJSON(),
  watchCommand.data.toJSON(),
  pingCommand.data.toJSON(),
  setupCommand.data.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const isGlobal = process.argv.includes('--global');

console.log(`🔄 Registering slash commands (${isGlobal ? 'global' : 'guild'})...`);

if (isGlobal) {
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log('✅ Global slash commands registered (up to 1h to propagate).');
} else {
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log('✅ Guild slash commands registered.');
}
