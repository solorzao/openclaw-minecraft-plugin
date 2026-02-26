const fs = require('fs');
const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');

const config = require('./config');
const { logEvent, loadEvents } = require('./events');
const { writeState } = require('./state');
const { pollCommands } = require('./commands');
const { survivalTick } = require('./survival');

// Ensure data directory exists
if (!fs.existsSync(config.DATA_DIR)) {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
}

// Initialize events from disk
loadEvents();

// Build bot config
const botConfig = {
  host: config.MC_HOST,
  port: config.MC_PORT,
  username: config.BOT_USERNAME,
};

if (config.MC_USERNAME && config.MC_PASSWORD) {
  console.log('Using Microsoft account authentication...');
  botConfig.auth = 'microsoft';
  botConfig.username = config.MC_USERNAME;
  botConfig.password = config.MC_PASSWORD;
}

console.log(`OpenClaw Minecraft Bot starting...`);
console.log(`  Server: ${botConfig.host}:${botConfig.port}`);
console.log(`  Username: ${botConfig.username}`);
console.log(`  Data: ${config.DATA_DIR}`);

const bot = mineflayer.createBot(botConfig);
bot.loadPlugin(pathfinder);

// --- Spawn ---
bot.on('spawn', () => {
  console.log(`${bot.username} spawned at ${bot.entity.position.floored()}`);

  const movements = new Movements(bot);
  movements.allowParkour = false;
  movements.canDig = true;
  movements.allowFreeMotion = false;
  bot.pathfinder.setMovements(movements);

  logEvent('spawn', {
    position: {
      x: Math.floor(bot.entity.position.x),
      y: Math.floor(bot.entity.position.y),
      z: Math.floor(bot.entity.position.z),
    },
  });

  // State broadcast loop
  setInterval(() => writeState(bot), config.STATE_INTERVAL_MS);

  // Command poll loop
  setInterval(() => pollCommands(bot), config.COMMAND_POLL_MS);

  // Survival tick loop
  setInterval(() => survivalTick(bot), config.SURVIVAL_INTERVAL_MS);
});

// --- Chat events ---
bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  logEvent('chat', { username, message });
});

bot.on('whisper', (username, message) => {
  if (username === bot.username) return;
  logEvent('whisper', { username, message });
});

// --- Health / damage ---
bot.on('health', () => {
  if (bot.health < 10) {
    logEvent('danger', { reason: 'low_health', health: bot.health, food: bot.food });
  }
});

bot.on('entityHurt', (entity) => {
  if (entity === bot.entity) {
    logEvent('hurt', { health: bot.health });
  }
});

bot.on('death', () => {
  logEvent('death', {});
  console.log('Bot died!');
});

bot.on('wake', () => {
  logEvent('woke_up', {});
});

// --- Pathfinder ---
bot.on('goal_reached', () => {
  logEvent('goal_reached', {});
  require('./state').clearCurrentAction();
});

bot.on('path_update', (r) => {
  if (r.status === 'noPath' || r.status === 'timeout' || r.status === 'stuck') {
    logEvent('path_failed', { status: r.status });
    require('./state').clearCurrentAction();
  }
});

// --- Errors ---
bot.on('error', (err) => {
  console.error('Bot error:', err.message);
  logEvent('error', { message: err.message });
});

bot.on('end', () => {
  console.log('Bot disconnected');
  logEvent('disconnect', {});
});

bot.on('kicked', (reason) => {
  console.log('Bot kicked:', reason);
  logEvent('kicked', { reason });
});
