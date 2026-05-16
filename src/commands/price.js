import { SlashCommandBuilder } from 'discord.js';
import { analyzeSymbol, buildSignalEmbed } from '../services/alerts.js';

export const priceCommand = {
  data: new SlashCommandBuilder()
    .setName('price')
    .setDescription('ดูราคาและสัญญาณ indicator ของ crypto')
    .addStringOption((opt) =>
      opt
        .setName('symbol')
        .setDescription('ชื่อ symbol เช่น BTC/USDT, ETH/USDT')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('timeframe')
        .setDescription('Timeframe (default: 1h)')
        .setRequired(false)
        .addChoices(
          { name: '15 นาที', value: '15m' },
          { name: '1 ชั่วโมง', value: '1h' },
          { name: '4 ชั่วโมง', value: '4h' },
          { name: '1 วัน', value: '1d' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const raw = interaction.options.getString('symbol').toUpperCase().trim();
    // รองรับทั้ง 'BTC' และ 'BTC/USDT'
    const symbol = raw.includes('/') ? raw : `${raw}/USDT`;
    const timeframe = interaction.options.getString('timeframe') ?? '1h';

    try {
      const result = await analyzeSymbol(symbol, timeframe);
      const embed = buildSignalEmbed(result);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[/price]', err.message);
      await interaction.editReply(`❌ ไม่พบ symbol **${symbol}** หรือ Binance ไม่รองรับ`);
    }
  },
};
