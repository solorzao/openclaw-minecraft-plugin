const fs = require('fs');
const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');

const config = require('./config');
const { logEvent, loadEvents } = require('./events');
const { writeState } = require('./state');
const { pollCommands } = require('./commands');
const { survivalTick } = require('./survival');
const { writeManifest } = require('./manifest');
const { HOSTILE_MOBS } = require('./perception');

// Ensure data directory exists
if (!fs.existsSync(config.DATA_DIR)) {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
}

// Initialize events from disk
loadEvents();

// Write capability manifest for agent discovery
writeManifest();

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

const RECONNECT_DELAY_MS = 15000;
let intervals = [];
let bot = null;
let reconnecting = false;

// Track last known weather for change detection
let lastWeather = null;

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

    // Initialize movements with improved pathfinder configuration
    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot);
    movements.allowParkour = true;
    movements.canDig = false;
    movements.allow1by1towers = true;
    movements.allowFreeMotion = false;
    movements.scafoldingBlocks = [];
    movements.canOpenDoors = true;

    // Configure blocks to avoid in pathfinding
    if (mcData.blocksByName.lava) movements.blocksToAvoid.add(mcData.blocksByName.lava.id);
    if (mcData.blocksByName.cactus) movements.blocksToAvoid.add(mcData.blocksByName.cactus.id);
    if (mcData.blocksByName.sweet_berry_bush) movements.blocksToAvoid.add(mcData.blocksByName.sweet_berry_bush.id);
    if (mcData.blocksByName.fire) movements.blocksToAvoid.add(mcData.blocksByName.fire.id);
    if (mcData.blocksByName.soul_fire) movements.blocksToAvoid.add(mcData.blocksByName.soul_fire.id);
    if (mcData.blocksByName.magma_block) movements.blocksToAvoid.add(mcData.blocksByName.magma_block.id);
    if (mcData.blocksByName.campfire) movements.blocksToAvoid.add(mcData.blocksByName.campfire.id);
    if (mcData.blocksByName.wither_rose) movements.blocksToAvoid.add(mcData.blocksByName.wither_rose.id);

    bot.pathfinder.setMovements(movements);

    const isRespawn = spawned;
    logEvent('spawn', {
      position: {
        x: Math.floor(bot.entity.position.x),
        y: Math.floor(bot.entity.position.y),
        z: Math.floor(bot.entity.position.z),
      },
      isRespawn,
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

  // --- Server/system messages (death messages, advancements, etc.) ---
  bot.on('message', (jsonMsg, position) => {
    // position: 'chat', 'system', or 'game_info' (action bar)
    // Only log system messages — chat messages are already handled by the 'chat' event
    if (position === 'system' || position === 'game_info') {
      const text = jsonMsg.toString();
      if (text && text.trim()) {
        logEvent('server_message', { message: text, type: position });
      }
    }
  });

  // --- Player join/leave ---
  bot.on('playerJoined', (player) => {
    if (player.username === bot.username) return;
    logEvent('player_joined', { username: player.username });
  });

  bot.on('playerLeft', (player) => {
    if (player.username === bot.username) return;
    logEvent('player_left', { username: player.username });
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
    const pos = bot.entity?.position;
    const deathData = pos ? {
      position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
    } : {};
    logEvent('death', deathData);
    console.log('Bot died!', pos ? `at ${pos.floored()}` : '');
    // Clear any active action on death
    require('./state').clearCurrentAction();
  });

  bot.on('wake', () => {
    logEvent('woke_up', {});
  });

  // --- Experience ---
  bot.on('experience', () => {
    logEvent('experience_gained', {
      level: bot.experience.level,
      points: bot.experience.points,
      progress: bot.experience.progress,
    });
  });

  // --- Entity lifecycle ---
  bot.on('entityGone', (entity) => {
    if (entity === bot.entity || !entity.position) return;
    const name = (entity.name || entity.displayName || '').toLowerCase();
    // Only log notable entities (hostiles, named entities, players) not clutter
    if (HOSTILE_MOBS.includes(name) || entity.type === 'player') {
      logEvent('entity_gone', {
        name: entity.name || entity.displayName || 'unknown',
        type: entity.type === 'player' ? 'player' : (HOSTILE_MOBS.includes(name) ? 'hostile' : 'passive'),
        reason: entity.isValid === false ? 'dead' : 'despawned',
      });
    }
  });

  // --- Digging events ---
  bot.on('diggingCompleted', (block) => {
    logEvent('dig_completed', {
      block: block.name,
      position: { x: block.position.x, y: block.position.y, z: block.position.z },
    });
  });

  bot.on('diggingAborted', (block) => {
    logEvent('dig_aborted', {
      block: block.name,
      position: { x: block.position.x, y: block.position.y, z: block.position.z },
    });
  });

  // --- Item pickup ---
  bot.on('playerCollect', (collector, collected) => {
    if (collector === bot.entity) {
      const itemEntity = collected;
      logEvent('item_collected', {
        collector: bot.username,
        item: itemEntity.name || 'item',
      });
    }
  });

  // --- Weather ---
  bot.on('weatherUpdate', () => {
    const newWeather = bot.isRaining ? (bot.thunderState ? 'thunder' : 'rain') : 'clear';
    if (lastWeather !== null && lastWeather !== newWeather) {
      logEvent('weather_changed', { old: lastWeather, new: newWeather });
    }
    lastWeather = newWeather;
  });

  // --- Pathfinder ---
  bot.on('goal_reached', () => {
    logEvent('goal_reached', {});
    require('./state').clearCurrentAction();
  });

  bot.on('path_update', (r) => {
    if (r.status === 'noPath' || r.status === 'timeout' || r.status === 'stuck') {
      const action = require('./state').getCurrentAction();
      // Don't clear follow action on timeout if we're close to the target
      if (action?.type === 'follow' && r.status === 'timeout') {
        const p = bot.players[action.username];
        if (p?.entity && bot.entity.position.distanceTo(p.entity.position) < 8) {
          return; // close enough, just wait
        }
      }
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

// Prevent unhandled promise rejections from crashing the bot
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err?.message || err);
  try { logEvent('error', { message: `Unhandled rejection: ${err?.message || err}` }); } catch (e) {}
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err?.message || err);
  try { logEvent('error', { message: `Uncaught exception: ${err?.message || err}` }); } catch (e) {}
  // For truly fatal errors, exit and let the process manager restart
  if (err?.message?.includes('FATAL') || err?.code === 'ERR_SOCKET_CLOSED') {
    process.exit(1);
  }
});

createBot();
