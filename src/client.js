import { Client, GatewayIntentBits, Collection } from 'discord.js';

export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
