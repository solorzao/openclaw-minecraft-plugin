const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalNear, GoalXZ } = goals;
const { logEvent } = require('../events');
const { setCurrentAction, clearCurrentAction } = require('../state');
const { getNearbyHostiles, HOSTILE_MOBS } = require('../perception');

const WEAPON_PRIORITY = ['netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'golden_sword', 'wooden_sword',
  'netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe'];

let combatInterval = null;
let rangedCombatActive = false;
let shieldBlockActive = false;

async function equipBestWeapon(bot) {
  for (const weaponName of WEAPON_PRIORITY) {
    const weapon = bot.inventory.items().find(i => i.name === weaponName);
    if (weapon) {
      try { await bot.equip(weapon, 'hand'); } catch (e) {}
      return weapon;
    }
  }
  return null;
}

function startCombat(bot, mob) {
  if (combatInterval) clearInterval(combatInterval);

  // Equip best weapon at start of combat
  equipBestWeapon(bot);

  combatInterval = setInterval(() => {
    const target = bot.entities[mob.id];
    if (!target || !target.position) {
      logEvent('combat_ended', { reason: 'target_gone', target: mob.name });
      stopCombat(bot);
      return;
    }

    const distance = bot.entity.position.distanceTo(target.position);
    if (distance > 4) {
      bot.pathfinder.setGoal(new GoalFollow(target, 2), true);
    }
    if (distance < 4) {
      bot.attack(target);
    }
    if (bot.health < 6) {
      logEvent('combat_retreat', { health: bot.health, reason: 'low_health' });
      stopCombat(bot);
      const fleeX = bot.entity.position.x + (bot.entity.position.x - target.position.x) * 2;
      const fleeZ = bot.entity.position.z + (bot.entity.position.z - target.position.z) * 2;
      bot.pathfinder.setGoal(new GoalXZ(Math.floor(fleeX), Math.floor(fleeZ)));
    }
  }, 250);
}

function stopCombat(bot) {
  if (combatInterval) {
    clearInterval(combatInterval);
    combatInterval = null;
  }
  clearCurrentAction();
  bot.pathfinder.setGoal(null);
}

async function attack(bot, cmd) {
  const targetType = (cmd.target || '').toLowerCase();

  // Filter: any entity that isn't the bot, a player, or clutter — mineflayer uses 'mob' for all mobs
  const candidates = Object.values(bot.entities)
    .filter(e => {
      if (e === bot.entity || !e.position) return false;
      if (e.type === 'player') return false;
      // Accept 'mob' type (mineflayer's actual type for mobs) and also check by name
      if (e.type === 'mob') return true;
      // Some entities might have a known hostile name without proper type
      const name = (e.name || '').toLowerCase();
      return HOSTILE_MOBS.includes(name);
    })
    .filter(e => bot.entity.position.distanceTo(e.position) < 32);

  let mob;
  if (targetType) {
    mob = candidates
      .filter(e => e.name?.toLowerCase() === targetType || e.name?.toLowerCase().includes(targetType))
      .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];
  } else {
    mob = candidates
      .filter(e => HOSTILE_MOBS.includes(e.name?.toLowerCase()))
      .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];
  }

  if (!mob) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No target found: ${targetType || 'hostile'}` });
    return;
  }

  setCurrentAction({ type: 'attack', target: mob.name, entityId: mob.id });
  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Attacking ${mob.name}` });
  startCombat(bot, mob);
}

async function shoot(bot, cmd) {
  const bow = bot.inventory.items().find(i => i.name === 'bow' || i.name === 'crossbow');
  if (!bow) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No bow in inventory' });
    return;
  }
  const arrows = bot.inventory.items().find(i => i.name.includes('arrow'));
  if (!arrows) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No arrows in inventory' });
    return;
  }

  const targetName = (cmd.target || '').toLowerCase();
  let target = null;

  if (targetName) {
    const player = Object.values(bot.players).find(p => p.username.toLowerCase() === targetName && p.entity);
    if (player) target = player.entity;
    if (!target) {
      target = Object.values(bot.entities)
        .filter(e => e.type === 'mob' && e.name?.toLowerCase().includes(targetName))
        .filter(e => e.position && bot.entity.position.distanceTo(e.position) < 64)
        .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];
    }
  } else {
    const hostiles = getNearbyHostiles(bot);
    target = hostiles[0];
  }

  if (!target || !target.position) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No target: ${targetName || 'hostile'}` });
    return;
  }

  await bot.equip(bow, 'hand');
  rangedCombatActive = true;
  setCurrentAction({ type: 'ranged_combat', target: target.name });
  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Engaging ${target.name} at range` });

  const loop = setInterval(async () => {
    const t = bot.entities[target.id];
    if (!t || !t.position) { clearInterval(loop); rangedCombatActive = false; clearCurrentAction(); return; }

    const distance = bot.entity.position.distanceTo(t.position);
    if (distance < 10) {
      const fx = bot.entity.position.x + (bot.entity.position.x - t.position.x);
      const fz = bot.entity.position.z + (bot.entity.position.z - t.position.z);
      bot.pathfinder.setGoal(new GoalNear(Math.floor(fx), bot.entity.position.y, Math.floor(fz), 1), true);
    } else if (distance > 30) {
      bot.pathfinder.setGoal(new GoalNear(t.position.x, t.position.y, t.position.z, 20), true);
    } else {
      bot.pathfinder.setGoal(null);
      await bot.lookAt(t.position.offset(0, t.height || 1.6, 0), true);
      bot.activateItem();
      await new Promise(r => setTimeout(r, 1000));
      bot.deactivateItem();
      logEvent('arrow_shot', { target: t.name, distance: Math.floor(distance) });
    }

    if (bot.health < 8) {
      clearInterval(loop); rangedCombatActive = false; clearCurrentAction();
      const fx = bot.entity.position.x + (bot.entity.position.x - t.position.x) * 3;
      const fz = bot.entity.position.z + (bot.entity.position.z - t.position.z) * 3;
      bot.pathfinder.setGoal(new GoalXZ(Math.floor(fx), Math.floor(fz)));
      logEvent('ranged_retreat', { health: bot.health });
    }

    if (!bot.inventory.items().find(i => i.name.includes('arrow'))) {
      clearInterval(loop); rangedCombatActive = false; clearCurrentAction();
    }
  }, 1500);
}

async function blockShield(bot, cmd) {
  const shield = bot.inventory.items().find(i => i.name === 'shield');
  if (!shield) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No shield in inventory' });
    return;
  }
  await bot.equip(shield, 'off-hand');
  shieldBlockActive = true;
  bot.activateItem(true);
  logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Blocking with shield' });

  setTimeout(() => {
    if (shieldBlockActive) {
      bot.deactivateItem();
      shieldBlockActive = false;
    }
  }, 5000);
}

module.exports = { attack, shoot, blockShield, stopCombat };
