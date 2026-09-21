import express from 'express';
import cors from 'cors';
import type { ProviderConfig } from './config.js';
import { BattleOfSkillsClient } from './battle-of-skills-client.js';
import { SessionThrottle } from './throttle.js';
import { createRouter } from './routes.js';
import { log } from './logger.js';

export function createApp(config: ProviderConfig): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.gameOrigins.includes(origin) || config.gameOrigins.includes('*')) {
          callback(null, true);
          return;
        }
        log.warn('CORS blocked origin', { origin });
        callback(null, false);
      },
      methods: ['GET', 'POST'],
    }),
  );
  app.use(express.json({ limit: '16kb' }));
  const client = new BattleOfSkillsClient(config);
  const throttle = new SessionThrottle();
  setInterval(() => throttle.sweep(1000 * 60 * 60), 1000 * 60 * 10).unref();
  app.use('/', createRouter({ config, client, throttle }));
  return app;
}
