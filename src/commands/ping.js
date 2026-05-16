import { SlashCommandBuilder } from 'discord.js';
import { client } from '../client.js';

export const pingCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('ตรวจสอบ latency ของ bot'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = client.ws.ping;

    await interaction.editReply(
      `🏓 **Pong!**\n` +
      `> Roundtrip: \`${roundtrip}ms\`\n` +
      `> WebSocket: \`${wsLatency}ms\``
    );
  },
};
