require('dotenv').config();
const path = require('path');

const DATA_DIR = process.env.BOT_DATA_DIR || path.join(__dirname, '..', 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const MANIFEST_FILE = path.join(DATA_DIR, 'manifest.json');

module.exports = {
  DATA_DIR,
  EVENTS_FILE,
  COMMANDS_FILE,
  STATE_FILE,
  MANIFEST_FILE,

  MC_HOST: process.env.MC_HOST || 'localhost',
  MC_PORT: parseInt(process.env.MC_PORT) || 25565,
  BOT_USERNAME: process.env.BOT_USERNAME || 'Bot_AI',

  // Online mode auth (optional)
  MC_USERNAME: process.env.MC_USERNAME || null,
  MC_PASSWORD: process.env.MC_PASSWORD || null,

  // Timing
  STATE_INTERVAL_MS: 1000,
  COMMAND_POLL_MS: 500,
  SURVIVAL_INTERVAL_MS: 1000,
};
