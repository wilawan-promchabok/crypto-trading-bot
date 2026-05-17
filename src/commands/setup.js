import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getGuildConfig, setGuildAlertChannel } from '../services/alerts.js';

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('ตั้งค่า bot สำหรับ server นี้ (เฉพาะผู้ดูแล)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('ตั้งค่า channel สำหรับรับ alert อัตโนมัติ')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel ที่ต้องการรับ alert')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('แสดงการตั้งค่าปัจจุบันของ server นี้')
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({ content: '❌ ต้องใช้คำสั่งนี้ใน server เท่านั้น', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      setGuildAlertChannel(guildId, channel.id);
      return interaction.reply(`✅ ตั้งค่า alert channel เป็น ${channel} แล้ว\nBot จะส่งสัญญาณอัตโนมัติมาที่ channel นี้`);
    }

    if (sub === 'status') {
      const config = getGuildConfig(guildId);
      const channelMention = config.alertChannelId ? `<#${config.alertChannelId}>` : '❌ ยังไม่ได้ตั้งค่า (ใช้ `/setup channel` เพื่อตั้งค่า)';
      const watchCount = config.watchlist?.length ?? 0;
      const threshold = config.threshold ?? 2;
      return interaction.reply(
        `⚙️ **การตั้งค่า server นี้**\n` +
        `Alert channel: ${channelMention}\n` +
        `Watchlist: **${watchCount} symbols** (ใช้ \`/watch list\` เพื่อดู)\n` +
        `Alert threshold: **${threshold}/4**`
      );
    }
  },
};
