import cron from 'node-cron';
import { sendAlerts } from './services/alerts.js';

export function startScheduler() {
  const interval  = process.env.ALERT_INTERVAL_CRON || '*/5 * * * *';
  const timeframe = process.env.ALERT_TIMEFRAME     || '1h';

  cron.schedule(interval, async () => {
    console.log(`[scheduler] Running signal check — ${new Date().toISOString()}`);
    try {
      await sendAlerts(timeframe);
    } catch (err) {
      console.error('[scheduler] sendAlerts failed:', err.message);
    }
  });

  console.log(`✅ Scheduler started (cron: ${interval}, timeframe: ${timeframe})`);
}
