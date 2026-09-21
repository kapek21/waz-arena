import { loadEnvFile } from './load-env.js';
import { loadConfig } from './config.js';
import { createApp } from './server.js';
import { log } from './logger.js';

loadEnvFile();
const config = loadConfig();
const app = createApp(config);
app.listen(config.port, () => {
  log.info('provider backend listening', {
    port: config.port,
    game: config.gameSlug,
    env: config.nodeEnv,
  });
});
