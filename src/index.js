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

const RECONNECT_DELAY_MS = 5000;
let intervals = [];
let bot = null;
let reconnecting = false;

function clearIntervals() {
  intervals.forEach(i => clearInterval(i));
  intervals = [];
}

function createBot() {
  reconnecting = false;

  // Remove all listeners from old bot to prevent ghost reconnects
  if (bot) {
    bot.removeAllListeners();
    bot = null;
  }

  bot = mineflayer.createBot(botConfig);
  bot.loadPlugin(pathfinder);

  let spawned = false;

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

    // Only start intervals on first spawn (not on respawn after death)
    if (!spawned) {
      spawned = true;
      clearIntervals();
      intervals.push(setInterval(() => writeState(bot), config.STATE_INTERVAL_MS));
      intervals.push(setInterval(() => pollCommands(bot), config.COMMAND_POLL_MS));
      intervals.push(setInterval(() => survivalTick(bot), config.SURVIVAL_INTERVAL_MS));
    }
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

  // --- Errors & reconnection ---
  bot.on('error', (err) => {
    console.error('Bot error:', err.message);
    logEvent('error', { message: err.message });
  });

  bot.on('kicked', (reason) => {
    console.log('Bot kicked:', reason);
    logEvent('kicked', { reason });
  });

  bot.on('end', (reason) => {
    console.log('Bot disconnected', reason || '');
    try { logEvent('disconnect', {}); } catch (e) {}
    clearIntervals();

    if (reconnecting) return; // prevent cascading reconnects
    reconnecting = true;

    console.log(`Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
    setTimeout(() => {
      try { createBot(); } catch (e) {
        console.error('Reconnect failed:', e.message);
        reconnecting = false;
        setTimeout(() => createBot(), RECONNECT_DELAY_MS);
      }
    }, RECONNECT_DELAY_MS);
  });
}

createBot();
