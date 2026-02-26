const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalFollow, GoalBlock, GoalNear, GoalXZ } = goals;
const { logEvent } = require('../events');
const { setCurrentAction, clearCurrentAction } = require('../state');

async function goto(bot, cmd) {
  const x = Math.floor(cmd.x);
  const y = Math.floor(cmd.y);
  const z = Math.floor(cmd.z);
  setCurrentAction({ type: 'goto', x, y, z });
  bot.pathfinder.setGoal(new GoalBlock(x, y, z), false);
  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Navigating to ${x}, ${y}, ${z}` });
}

async function follow(bot, cmd) {
  const p = bot.players[cmd.username];
  if (!p?.entity) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Can't see ${cmd.username}` });
    return;
  }
  const dist = typeof cmd.distance === 'number' ? cmd.distance : 2;
  setCurrentAction({ type: 'follow', username: cmd.username, distance: dist });
  bot.pathfinder.setGoal(new GoalFollow(p.entity, dist), true);
  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Following ${cmd.username}` });
}

async function stop(bot, cmd) {
  clearCurrentAction();
  bot.pathfinder.setGoal(null);
  logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Stopped all movement' });
}

async function lookAtPlayer(bot, cmd) {
  const p = bot.players[cmd.username];
  if (p?.entity) {
    await bot.lookAt(p.entity.position.offset(0, p.entity.height, 0));
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Looking at ${cmd.username}` });
  } else {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Can't see ${cmd.username}` });
  }
}

async function lookAt(bot, cmd) {
  let target;
  if (cmd.position) target = new Vec3(cmd.position.x, cmd.position.y, cmd.position.z);
  else if (cmd.player) {
    const p = bot.players[cmd.player];
    if (p?.entity) target = p.entity.position.offset(0, p.entity.height || 1.6, 0);
  }
  else if (cmd.block) target = new Vec3(cmd.block.x, cmd.block.y, cmd.block.z);

  if (target) {
    await bot.lookAt(target, cmd.force || false);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Looked at target' });
  } else {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No target found' });
  }
}

async function jump(bot, cmd) {
  bot.setControlState('jump', true);
  setTimeout(() => bot.setControlState('jump', false), 120);
  logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Jumped' });
}

async function sneak(bot, cmd) {
  bot.setControlState('sneak', true);
  setTimeout(() => bot.setControlState('sneak', false), cmd.duration || 500);
  logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Sneaking' });
}

async function steer(bot, cmd) {
  if (!bot.vehicle) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Not in a vehicle' });
    return;
  }
  const dir = cmd.direction || 'forward';
  const controls = { forward: 'forward', back: 'back', left: 'left', right: 'right' };
  const control = controls[dir];
  if (control) {
    bot.setControlState(control, true);
    setTimeout(() => bot.setControlState(control, false), cmd.duration || 1000);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Steering ${dir}` });
  }
}

async function mount(bot, cmd) {
  const mountableTypes = ['horse', 'boat', 'minecart', 'pig', 'donkey', 'mule'];
  let target = null;

  if (cmd.entityId) {
    target = bot.entities[cmd.entityId];
  } else {
    target = Object.values(bot.entities)
      .filter(e => e.position &&
        mountableTypes.some(t => e.name?.toLowerCase().includes(t)) &&
        bot.entity.position.distanceTo(e.position) < 5)
      .sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];
  }

  if (!target) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No mountable entity nearby' });
    return;
  }

  try {
    await bot.mount(target);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Mounted ${target.name}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function dismount(bot, cmd) {
  try {
    await bot.dismount();
    logEvent('command_result', { commandId: cmd.id, success: true, detail: 'Dismounted' });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

module.exports = { goto, follow, stop, lookAtPlayer, lookAt, jump, sneak, steer, mount, dismount };
