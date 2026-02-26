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

// Entities to exclude from nearbyEntities (noise, not useful for agent decisions)
const CLUTTER_ENTITIES = ['arrow', 'item', 'experience_orb', 'falling_block', 'area_effect_cloud'];

function getNearbyEntities(bot) {
  const playerNames = new Set(
    Object.values(bot.players).map(p => p.username)
  );
  const botY = bot.entity.position.y;

  return Object.values(bot.entities)
    .filter(e => {
      if (e === bot.entity || !e.position) return false;
      if (e.type === 'player' || playerNames.has(e.username)) return false;

      const name = (e.name || '').toLowerCase();

      // Filter out clutter entities
      if (CLUTTER_ENTITIES.includes(name)) return false;

      // Filter out mobs that are too far vertically (underground/above, unreachable)
      const yDiff = Math.abs(e.position.y - botY);
      if (yDiff > 10) return false;

      return bot.entity.position.distanceTo(e.position) < 32;
    })
    .map(e => {
      const name = e.name || e.displayName || 'unknown';
      let type = 'passive';
      if (HOSTILE_MOBS.includes(name.toLowerCase())) type = 'hostile';

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
    .filter(e => e.position &&
      HOSTILE_MOBS.includes((e.name || e.displayName || '').toLowerCase()) &&
      bot.entity.position.distanceTo(e.position) < 20)
    .sort((a, b) =>
      bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position));
}

function getNearbyBlocks(bot) {
  const counts = {};
  const pos = bot.entity.position.floored();
  // Scan 16x8x16 area (8 blocks horizontal, 4 up/down)
  for (let dx = -8; dx <= 8; dx++) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dz = -8; dz <= 8; dz++) {
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

function getLightLevel(bot) {
  try {
    const block = bot.blockAt(bot.entity.position.floored());
    return block ? block.light : 0;
  } catch (e) {
    return 0;
  }
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
  getLightLevel,
  getInventory,
  getTimePhase,
  countInventoryItem,
  hasItem,
};
