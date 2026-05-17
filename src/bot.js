import { REST, Routes } from 'discord.js';
import { client } from './client.js';
import { priceCommand } from './commands/price.js';
import { watchCommand } from './commands/watch.js';
import { pingCommand } from './commands/ping.js';
import { setupCommand } from './commands/setup.js';

client.commands.set(priceCommand.data.name, priceCommand);
client.commands.set(watchCommand.data.name, watchCommand);
client.commands.set(pingCommand.data.name, pingCommand);
client.commands.set(setupCommand.data.name, setupCommand);

client.once('ready', () => {
  console.log(`✅ Bot ready: ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    const msg = { content: '❌ เกิดข้อผิดพลาด', ephemeral: true };
    interaction.replied ? await interaction.followUp(msg) : await interaction.reply(msg);
  }
});

export async function startBot() {
  await client.login(process.env.DISCORD_TOKEN);
}
