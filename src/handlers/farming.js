const Vec3 = require('vec3');
const { goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const { logEvent } = require('../events');
const { setCurrentAction, clearCurrentAction } = require('../state');

const CROP_DATA = {
  'wheat':          { seed: 'wheat_seeds',    crop: 'wheat',       age: 7, replant: true },
  'wheat_seeds':    { seed: 'wheat_seeds',    crop: 'wheat',       age: 7, replant: true },
  'carrot':         { seed: 'carrot',         crop: 'carrots',     age: 7, replant: true },
  'carrots':        { seed: 'carrot',         crop: 'carrots',     age: 7, replant: true },
  'potato':         { seed: 'potato',         crop: 'potatoes',    age: 7, replant: true },
  'potatoes':       { seed: 'potato',         crop: 'potatoes',    age: 7, replant: true },
  'beetroot':       { seed: 'beetroot_seeds', crop: 'beetroots',   age: 3, replant: true },
  'beetroot_seeds': { seed: 'beetroot_seeds', crop: 'beetroots',   age: 3, replant: true },
  'melon':          { seed: 'melon_seeds',    crop: 'melon_stem',  age: 7, replant: false },
  'pumpkin':        { seed: 'pumpkin_seeds',  crop: 'pumpkin_stem', age: 7, replant: false },
  'nether_wart':    { seed: 'nether_wart',    crop: 'nether_wart', age: 3, replant: true },
};

const HOE_TYPES = ['netherite_hoe', 'diamond_hoe', 'iron_hoe', 'golden_hoe', 'stone_hoe', 'wooden_hoe'];

async function till(bot, cmd) {
  const radius = cmd.radius || 5;
  const hoe = bot.inventory.items().find(i => HOE_TYPES.includes(i.name));
  if (!hoe) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No hoe in inventory' });
    return;
  }

  await bot.equip(hoe, 'hand');

  const waterBlocks = bot.findBlocks({ matching: b => b.name === 'water', maxDistance: 32, count: 10 });
  if (waterBlocks.length === 0) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No water nearby for farming' });
    return;
  }

  const waterPos = waterBlocks[0];
  const tillable = [];

  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      for (let y = -1; y <= 1; y++) {
        const block = bot.blockAt(waterPos.offset(x, y, z));
        if (block && (block.name === 'dirt' || block.name === 'grass_block' || block.name === 'coarse_dirt')) {
          const above = bot.blockAt(waterPos.offset(x, y + 1, z));
          if (above && above.name === 'air') tillable.push(block);
        }
      }
    }
  }

  if (tillable.length === 0) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No tillable dirt near water' });
    return;
  }

  let tilled = 0;
  for (const block of tillable.slice(0, 20)) {
    try {
      if (bot.entity.position.distanceTo(block.position) > 4) {
        await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 2));
      }
      await bot.activateBlock(block);
      tilled++;
      await new Promise(r => setTimeout(r, 250));
    } catch (e) {}
  }

  logEvent('command_result', { commandId: cmd.id, success: tilled > 0, detail: `Tilled ${tilled} blocks` });
}

async function plant(bot, cmd) {
  const cropType = (cmd.crop || 'wheat').toLowerCase().replace(/ /g, '_');
  const cropInfo = CROP_DATA[cropType];
  if (!cropInfo) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `Unknown crop: ${cropType}` });
    return;
  }

  const seeds = bot.inventory.items().find(i => i.name === cropInfo.seed);
  if (!seeds) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: `No ${cropInfo.seed} in inventory` });
    return;
  }

  await bot.equip(seeds, 'hand');
  const farmland = bot.findBlocks({ matching: b => b.name === 'farmland', maxDistance: 32, count: 50 });
  if (farmland.length === 0) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No farmland to plant on' });
    return;
  }

  let planted = 0;
  for (const pos of farmland) {
    if (planted >= seeds.count) break;
    const above = bot.blockAt(pos.offset(0, 1, 0));
    if (above && above.name !== 'air') continue;

    try {
      if (bot.entity.position.distanceTo(pos) > 4) {
        await bot.pathfinder.goto(new GoalNear(pos.x, pos.y, pos.z, 2));
      }
      const block = bot.blockAt(pos);
      await bot.placeBlock(block, new Vec3(0, 1, 0));
      planted++;
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {}
  }

  logEvent('command_result', { commandId: cmd.id, success: planted > 0, detail: `Planted ${planted} ${cropType}` });
}

async function harvest(bot, cmd) {
  const autoReplant = cmd.autoReplant !== false;
  const matureCrops = [];

  for (const [, info] of Object.entries(CROP_DATA)) {
    const blocks = bot.findBlocks({
      matching: b => {
        if (!b.name.includes(info.crop.split('_')[0])) return false;
        const props = b.getProperties ? b.getProperties() : {};
        return props.age !== undefined && parseInt(props.age) >= info.age;
      },
      maxDistance: 32, count: 50,
    });
    for (const pos of blocks) matureCrops.push({ pos, info });
  }

  if (matureCrops.length === 0) {
    logEvent('command_result', { commandId: cmd.id, success: false, detail: 'No mature crops' });
    return;
  }

  let harvested = 0, replanted = 0;
  for (const { pos, info } of matureCrops) {
    try {
      if (bot.entity.position.distanceTo(pos) > 4) {
        await bot.pathfinder.goto(new GoalNear(pos.x, pos.y, pos.z, 2));
      }
      const block = bot.blockAt(pos);
      if (block) {
        await bot.dig(block);
        harvested++;
        await new Promise(r => setTimeout(r, 300));

        if (autoReplant && info.replant) {
          const seeds = bot.inventory.items().find(i => i.name === info.seed);
          if (seeds) {
            await bot.equip(seeds, 'hand');
            const farmland = bot.blockAt(pos.offset(0, -1, 0));
            if (farmland && farmland.name === 'farmland') {
              try { await bot.placeBlock(farmland, new Vec3(0, 1, 0)); replanted++; } catch (e) {}
            }
          }
        }
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {}
  }

  logEvent('command_result', { commandId: cmd.id, success: harvested > 0, detail: `Harvested ${harvested}, replanted ${replanted}` });
}

async function farm(bot, cmd) {
  const cropType = cmd.crop || 'wheat';
  setCurrentAction({ type: 'farming', crop: cropType });

  const farmland = bot.findBlock({ matching: b => b.name === 'farmland', maxDistance: 32 });
  if (!farmland) await till(bot, { ...cmd, radius: 5 });
  await plant(bot, { ...cmd, crop: cropType });

  logEvent('command_result', { commandId: cmd.id, success: true, detail: `Farm cycle started for ${cropType}` });

  const cropInfo = CROP_DATA[cropType];
  if (!cropInfo) { clearCurrentAction(); return; }

  const check = setInterval(async () => {
    const mature = bot.findBlock({
      matching: b => {
        if (!b.name.includes(cropInfo.crop.split('_')[0])) return false;
        const props = b.getProperties ? b.getProperties() : {};
        return props.age !== undefined && parseInt(props.age) >= cropInfo.age;
      },
      maxDistance: 32,
    });
    if (mature) {
      clearInterval(check);
      await harvest(bot, { ...cmd, autoReplant: true });
      clearCurrentAction();
    }
  }, 60000);

  setTimeout(() => { clearInterval(check); clearCurrentAction(); }, 1800000);
}

module.exports = { till, plant, harvest, farm };
