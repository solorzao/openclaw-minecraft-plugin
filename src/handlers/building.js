const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const { logEvent } = require('../events');
const { setCurrentAction, clearCurrentAction } = require('../state');

const BUILD_TEMPLATES = {
  shelter_3x3: {
    blocks: [
      { x: -1, y: 0, z: -1 }, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: -1 },
      { x: -1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 },
      { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
      { x: -1, y: 1, z: -1 }, { x: 0, y: 1, z: -1 }, { x: 1, y: 1, z: -1 },
      { x: -1, y: 1, z: 1 }, { x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 },
      { x: -1, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
      { x: -1, y: 2, z: -1 }, { x: 0, y: 2, z: -1 }, { x: 1, y: 2, z: -1 },
      { x: -1, y: 2, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 },
      { x: -1, y: 2, z: 1 }, { x: 0, y: 2, z: 1 }, { x: 1, y: 2, z: 1 },
    ],
  },
  pillar: { blocks: [{ x:0,y:0,z:0 },{ x:0,y:1,z:0 },{ x:0,y:2,z:0 },{ x:0,y:3,z:0 },{ x:0,y:4,z:0 }] },
  bridge: { blocks: Array.from({ length: 10 }, (_, i) => ({ x: 0, y: 0, z: i })) },
  wall: {
    blocks: [
      ...Array.from({ length: 5 }, (_, i) => ({ x: i, y: 0, z: 0 })),
      ...Array.from({ length: 5 }, (_, i) => ({ x: i, y: 1, z: 0 })),
      ...Array.from({ length: 5 }, (_, i) => ({ x: i, y: 2, z: 0 })),
    ],
  },
};

async function place(bot, cmd) {
  const blockType = cmd.blockType || cmd.item;
  const item = bot.inventory.items().find(i => i.name === blockType || i.name.includes(blockType));

  if (!item) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No ${blockType} in inventory` });
    return;
  }

  try {
    await bot.equip(item, 'hand');
    let refBlock, faceVec;

    if (cmd.position) {
      const targetPos = new Vec3(cmd.position.x, cmd.position.y, cmd.position.z);
      const below = bot.blockAt(targetPos.offset(0, -1, 0));
      if (below && below.name !== 'air') { refBlock = below; faceVec = new Vec3(0, 1, 0); }
    } else {
      refBlock = bot.blockAt(bot.entity.position.floored().offset(0, -1, 1));
      faceVec = new Vec3(0, 1, 0);
    }

    if (!refBlock || refBlock.name === 'air') {
      logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No reference block to place against' });
      return;
    }

    await bot.placeBlock(refBlock, faceVec);
    logEvent('command_result', { commandId: cmd.id, success: true, detail: `Placed ${item.name}` });
  } catch (err) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: err.message });
  }
}

async function build(bot, cmd) {
  const templateName = cmd.template;
  const blockType = cmd.blockType || 'cobblestone';
  const template = BUILD_TEMPLATES[templateName];

  if (!template) {
    const available = Object.keys(BUILD_TEMPLATES).join(', ');
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Unknown template: ${templateName}. Available: ${available}` });
    return;
  }

  const buildBlock = bot.inventory.items().find(i =>
    i.name.includes(blockType) || i.name.includes('cobblestone') || i.name.includes('planks'));

  if (!buildBlock || buildBlock.count < template.blocks.length) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'Not enough building materials' });
    return;
  }

  await bot.equip(buildBlock, 'hand');
  const basePos = bot.entity.position.floored().offset(2, 0, 0);
  let placed = 0;
  setCurrentAction({ type: 'building', template: templateName });

  for (const offset of template.blocks) {
    const targetPos = basePos.offset(offset.x, offset.y, offset.z);
    const existing = bot.blockAt(targetPos);
    if (existing && existing.name !== 'air') continue;

    const below = bot.blockAt(targetPos.offset(0, -1, 0));
    const sides = [
      { block: bot.blockAt(targetPos.offset(0, 0, -1)), face: new Vec3(0, 0, 1) },
      { block: bot.blockAt(targetPos.offset(0, 0, 1)), face: new Vec3(0, 0, -1) },
      { block: bot.blockAt(targetPos.offset(1, 0, 0)), face: new Vec3(-1, 0, 0) },
      { block: bot.blockAt(targetPos.offset(-1, 0, 0)), face: new Vec3(1, 0, 0) },
    ];

    let refBlock = null, faceVec = null;
    if (below && below.name !== 'air') { refBlock = below; faceVec = new Vec3(0, 1, 0); }
    else {
      for (const s of sides) {
        if (s.block && s.block.name !== 'air') { refBlock = s.block; faceVec = s.face; break; }
      }
    }
    if (!refBlock) continue;

    try {
      const dist = bot.entity.position.distanceTo(targetPos);
      if (dist > 4) await bot.pathfinder.goto(new GoalNear(targetPos.x, targetPos.y, targetPos.z, 3));
      await bot.placeBlock(refBlock, faceVec);
      placed++;
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {}
  }

  clearCurrentAction();
  logEvent('command_result', { commandId: cmd.id, success: placed > 0, detail: `Built ${templateName}: placed ${placed} blocks` });
}

module.exports = { place, build };
