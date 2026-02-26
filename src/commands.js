const fs = require('fs');
const { COMMANDS_FILE } = require('./config');
const { logEvent } = require('./events');

// Import handlers
const movement = require('./handlers/movement');
const combat = require('./handlers/combat');
const gathering = require('./handlers/gathering');
const crafting = require('./handlers/crafting');
const building = require('./handlers/building');
const farming = require('./handlers/farming');
const interaction = require('./handlers/interaction');
const utility = require('./handlers/utility');

// Map action names to handler functions
const DISPATCH = {
  // Movement
  goto:           movement.goto,
  follow:         movement.follow,
  stop:           movement.stop,
  look_at_player: movement.lookAtPlayer,
  look_at:        movement.lookAt,
  jump:           movement.jump,
  sneak:          movement.sneak,
  steer:          movement.steer,
  mount:          movement.mount,
  dismount:       movement.dismount,

  // Combat
  attack:         combat.attack,
  shoot:          combat.shoot,
  block_shield:   combat.blockShield,

  // Gathering
  dig:            gathering.dig,
  mine_resource:  gathering.mineResource,
  find_food:      gathering.findFood,
  collect_items:  gathering.collectItems,
  drop:           gathering.drop,
  give:           gathering.give,

  // Crafting
  craft:          crafting.craft,
  smelt:          crafting.smelt,
  cook_food:      crafting.cookFood,

  // Building
  place:          building.place,
  build:          building.build,

  // Farming
  till:           farming.till,
  plant:          farming.plant,
  harvest:        farming.harvest,
  farm:           farming.farm,

  // Interaction
  chat:           interaction.chat,
  equip:          interaction.equip,
  eat:            interaction.eat,
  sleep:          interaction.sleep,
  activate:       interaction.activate,
  fish:           interaction.fish,
  use_on:         interaction.useOn,
  trade:          interaction.trade,
  brew:           interaction.brew,
  enchant:        interaction.enchant,
  store_items:    interaction.storeItems,
  retrieve_items: interaction.retrieveItems,
  manage_inventory: interaction.manageInventory,

  // Utility
  scan:                utility.scan,
  find_blocks:         utility.findBlocks,
  where_am_i:          utility.whereAmI,
  list_recipes:        utility.listRecipes,
  goto_block:          utility.gotoNearestBlock,
  verify:              utility.verify,
  cancel:              utility.cancel,
  inspect_container:   utility.inspectContainer,
  set_note:            utility.setNote,
  get_notes:           utility.getNotes,

  // Goal shortcuts
  goal: async (bot, cmd) => {
    const { GoalBlock, GoalXZ, GoalNear } = require('mineflayer-pathfinder').goals;
    const { setCurrentAction } = require('./state');

    switch (cmd.goal) {
      case 'gather_wood': {
        const log = bot.findBlock({ matching: b => b.name.includes('log'), maxDistance: 64 });
        if (log) {
          setCurrentAction({ type: 'goal', goal: 'gather_wood' });
          bot.pathfinder.setGoal(new GoalNear(log.position.x, log.position.y, log.position.z, 1));
          logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Gathering wood' });
        } else {
          logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No trees nearby' });
        }
        break;
      }
      case 'explore': {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 40;
        const x = Math.floor(bot.entity.position.x + Math.cos(angle) * dist);
        const z = Math.floor(bot.entity.position.z + Math.sin(angle) * dist);
        setCurrentAction({ type: 'goal', goal: 'explore' });
        bot.pathfinder.setGoal(new GoalXZ(x, z));
        logEvent('command_result', { commandId: cmd.id, success: true, detail: `Exploring toward ${x}, ${z}` });
        break;
      }
      default:
        logEvent('command_result', { commandId: cmd.id, success: false, detail: `Unknown goal: ${cmd.goal}` });
    }
  },
};

async function executeCommand(bot, cmd) {
  const handler = DISPATCH[cmd.action];
  if (!handler) {
    const available = Object.keys(DISPATCH).join(', ');
    logEvent('command_result', {
      commandId: cmd.id, success: false,
      detail: `Unknown action: ${cmd.action}`,
      hint: `Available actions: ${available}`,
    });
    return;
  }

  try {
    // Log command acknowledgment so LLM knows the command was received
    logEvent('command_received', { commandId: cmd.id, action: cmd.action });
    await handler(bot, cmd);
  } catch (err) {
    logEvent('command_result', {
      commandId: cmd.id, success: false,
      detail: `Error: ${err.message}`,
      action: cmd.action,
      errorType: err.constructor?.name || 'Error',
    });
  }
}

function pollCommands(bot) {
  try {
    if (!fs.existsSync(COMMANDS_FILE)) return;
    const raw = fs.readFileSync(COMMANDS_FILE, 'utf8').trim();
    if (!raw || raw === '[]') return;

    const commands = JSON.parse(raw);
    // Clear commands file immediately to prevent re-execution
    fs.writeFileSync(COMMANDS_FILE, '[]');

    if (!Array.isArray(commands) || commands.length === 0) return;

    for (const cmd of commands) {
      console.log('Executing:', cmd.action, cmd.id || '');
      executeCommand(bot, cmd);
    }
  } catch (err) {
    // Ignore parse errors from partial writes
    if (err instanceof SyntaxError) return;
    console.error('Command poll error:', err.message);
  }
}

module.exports = { pollCommands, executeCommand };
