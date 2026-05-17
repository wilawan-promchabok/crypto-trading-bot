import { SlashCommandBuilder } from 'discord.js';
import { getGuildWatchList, saveGuildWatchList, getGuildThreshold, setGuildThreshold } from '../services/alerts.js';
import { validateSymbol } from '../services/exchange.js';

export const watchCommand = {
  data: new SlashCommandBuilder()
    .setName('watch')
    .setDescription('จัดการรายการ coin ที่ bot จะแจ้งเตือนอัตโนมัติ')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('เพิ่ม coin เข้า watchlist')
        .addStringOption((opt) =>
          opt.setName('symbol').setDescription('เช่น BTC หรือ BTC/USDT').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('ลบ coin ออกจาก watchlist')
        .addStringOption((opt) =>
          opt.setName('symbol').setDescription('เช่น BTC หรือ BTC/USDT').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('ดูรายการ coin ทั้งหมด'))
    .addSubcommand((sub) =>
      sub
        .setName('threshold')
        .setDescription('ตั้งค่า score ขั้นต่ำสำหรับส่ง alert (ค่าปัจจุบัน: /watch threshold)')
        .addIntegerOption((opt) =>
          opt
            .setName('value')
            .setDescription('จำนวน indicator ที่ต้องเห็นด้วย (1–4, default: 2)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(4)
        )
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({ content: '❌ ต้องใช้คำสั่งนี้ใน server เท่านั้น', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const list = [...getGuildWatchList(guildId)];
      const threshold = getGuildThreshold(guildId);
      if (list.length === 0) {
        return interaction.reply(`📋 Watchlist ว่างเปล่า\n🔔 Alert threshold: **${threshold}/4**`);
      }
      return interaction.reply(
        `📋 **Watchlist (${list.length} symbols):**\n${list.map((s) => `• ${s}`).join('\n')}\n\n🔔 Alert threshold: **${threshold}/4**`
      );
    }

    const raw = interaction.options.getString('symbol').toUpperCase().trim();
    const symbol = raw.includes('/') ? raw : `${raw}/USDT`;

    if (sub === 'add') {
      await interaction.deferReply();
      const valid = await validateSymbol(symbol).catch(() => false);
      if (!valid) {
        return interaction.editReply(`❌ ไม่พบ **${symbol}** บน Binance กรุณาตรวจสอบ symbol อีกครั้ง`);
      }
      const watchList = getGuildWatchList(guildId);
      watchList.add(symbol);
      saveGuildWatchList(guildId, watchList);
      return interaction.editReply(`✅ เพิ่ม **${symbol}** เข้า watchlist แล้ว (รวม ${watchList.size} symbols)`);
    }

    if (sub === 'remove') {
      const watchList = getGuildWatchList(guildId);
      if (!watchList.has(symbol)) {
        return interaction.reply(`⚠️ ไม่พบ **${symbol}** ใน watchlist`);
      }
      watchList.delete(symbol);
      saveGuildWatchList(guildId, watchList);
      return interaction.reply(`🗑️ ลบ **${symbol}** ออกจาก watchlist แล้ว`);
    }

    if (sub === 'threshold') {
      const value = interaction.options.getInteger('value');
      if (value === null) {
        return interaction.reply(`🔔 Alert threshold ปัจจุบัน: **${getGuildThreshold(guildId)}/4**`);
      }
      setGuildThreshold(guildId, value);
      return interaction.reply(`✅ ตั้ง alert threshold เป็น **${value}/4** แล้ว`);
    }
  },
};
