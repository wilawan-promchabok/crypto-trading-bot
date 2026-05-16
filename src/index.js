import 'dotenv/config';
import { startBot } from './bot.js';
import { startScheduler } from './scheduler.js';
import { startHealthServer } from './health.js';

await startBot();
startScheduler();
startHealthServer();
