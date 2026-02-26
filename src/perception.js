const HOSTILE_MOBS = [
  'zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch',
  'pillager', 'vindicator', 'evoker', 'ravager', 'phantom',
  'drowned', 'husk', 'stray', 'blaze', 'ghast', 'wither_skeleton',
];

const FOOD_ITEMS = [
  'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton', 'cooked_rabbit',
  'cooked_salmon', 'cooked_cod', 'bread', 'apple', 'golden_apple', 'enchanted_golden_apple',
  'baked_potato', 'pumpkin_pie', 'cake', 'cookie', 'melon_slice', 'sweet_berries',
  'beef', 'porkchop', 'chicken', 'mutton', 'rabbit',
  'carrot', 'potato', 'beetroot', 'dried_kelp',
];

function getNearbyPlayers(bot) {
  return Object.values(bot.players)
    .filter(p => p.entity && p.username !== bot.username &&
      bot.entity.position.distanceTo(p.entity.position) < 60)
    .map(p => ({
      name: p.username,
      type: 'player',
      distance: Math.floor(bot.entity.position.distanceTo(p.entity.position)),
      position: {
        x: Math.floor(p.entity.position.x),
        y: Math.floor(p.entity.position.y),
        z: Math.floor(p.entity.position.z),
      },
    }));
}

function getNearbyEntities(bot) {
  return Object.values(bot.entities)
    .filter(e => e !== bot.entity && e.position &&
      bot.entity.position.distanceTo(e.position) < 32)
    .map(e => {
      const name = e.name || e.displayName || 'unknown';
      let type = 'passive';
      if (e.type === 'player') type = 'player';
      else if (HOSTILE_MOBS.includes(name.toLowerCase())) type = 'hostile';

      return {
        name,
        type,
        distance: Math.floor(bot.entity.position.distanceTo(e.position)),
        position: {
          x: Math.floor(e.position.x),
          y: Math.floor(e.position.y),
          z: Math.floor(e.position.z),
        },
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 20);
}

function getNearbyHostiles(bot) {
  return Object.values(bot.entities)
    .filter(e => e.type === 'mob' && e.position &&
      HOSTILE_MOBS.includes(e.name?.toLowerCase()) &&
      bot.entity.position.distanceTo(e.position) < 20)
    .sort((a, b) =>
      bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position));
}

function getNearbyBlocks(bot) {
  const counts = {};
  const pos = bot.entity.position.floored();
  for (let dx = -4; dx <= 4; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dz = -4; dz <= 4; dz++) {
        try {
          const block = bot.blockAt(pos.offset(dx, dy, dz));
          if (block && block.name !== 'air' && block.name !== 'cave_air') {
            counts[block.name] = (counts[block.name] || 0) + 1;
          }
        } catch (e) {}
      }
    }
  }
  return counts;
}

function getInventory(bot) {
  return bot.inventory.items().map(item => ({
    name: item.name,
    count: item.count,
    slot: item.slot,
  }));
}

function getTimePhase(bot) {
  const t = bot.time.timeOfDay;
  if (t >= 12541 && t <= 23458) return 'night';
  if (t >= 11616 && t < 12541) return 'sunset';
  return 'day';
}

function countInventoryItem(bot, itemName) {
  return bot.inventory.items()
    .filter(i => i.name === itemName || i.name.includes(itemName))
    .reduce((sum, i) => sum + i.count, 0);
}

function hasItem(bot, itemName) {
  return countInventoryItem(bot, itemName) > 0;
}

module.exports = {
  HOSTILE_MOBS,
  FOOD_ITEMS,
  getNearbyPlayers,
  getNearbyEntities,
  getNearbyHostiles,
  getNearbyBlocks,
  getInventory,
  getTimePhase,
  countInventoryItem,
  hasItem,
};
