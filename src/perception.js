const HOSTILE_MOBS = [
  'zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch',
  'pillager', 'vindicator', 'evoker', 'ravager', 'phantom',
  'drowned', 'husk', 'stray', 'blaze', 'ghast', 'wither_skeleton',
  'warden', 'piglin_brute', 'hoglin', 'zoglin', 'guardian', 'elder_guardian',
  'shulker', 'vex', 'slime', 'magma_cube', 'cave_spider', 'silverfish',
  'zombie_villager', 'illusioner', 'wither', 'ender_dragon', 'breeze',
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

      const entity = {
        name,
        type,
        distance: Math.floor(bot.entity.position.distanceTo(e.position)),
        position: {
          x: Math.floor(e.position.x),
          y: Math.floor(e.position.y),
          z: Math.floor(e.position.z),
        },
      };

      // Include entity health when available (metadata index 9 in most versions)
      const health = e.metadata?.[9];
      if (typeof health === 'number' && health > 0) {
        entity.health = Math.round(health * 10) / 10;
      }

      // Include entity ID for targeting
      entity.entityId = e.id;

      return entity;
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

function getEquipment(bot) {
  const slots = {
    hand: bot.heldItem,
    offHand: bot.inventory.slots[45],
    head: bot.inventory.slots[5],
    chest: bot.inventory.slots[6],
    legs: bot.inventory.slots[7],
    feet: bot.inventory.slots[8],
  };
  const result = {};
  for (const [slot, item] of Object.entries(slots)) {
    result[slot] = item ? { name: item.name, count: item.count } : null;
  }
  return result;
}

function getArmorRating(bot) {
  const armorSlots = [5, 6, 7, 8]; // head, chest, legs, feet
  let totalProtection = 0;
  const pieces = [];
  for (const slot of armorSlots) {
    const item = bot.inventory.slots[slot];
    if (item) {
      pieces.push(item.name);
      const name = item.name;
      if (name.includes('netherite')) totalProtection += name.includes('chestplate') ? 8 : name.includes('leggings') ? 6 : name.includes('helmet') ? 3 : 3;
      else if (name.includes('diamond')) totalProtection += name.includes('chestplate') ? 8 : name.includes('leggings') ? 6 : name.includes('helmet') ? 3 : 3;
      else if (name.includes('iron')) totalProtection += name.includes('chestplate') ? 6 : name.includes('leggings') ? 5 : name.includes('helmet') ? 2 : 2;
      else if (name.includes('chain')) totalProtection += name.includes('chestplate') ? 5 : name.includes('leggings') ? 4 : name.includes('helmet') ? 2 : 1;
      else if (name.includes('gold')) totalProtection += name.includes('chestplate') ? 5 : name.includes('leggings') ? 3 : name.includes('helmet') ? 2 : 1;
      else if (name.includes('leather')) totalProtection += name.includes('chestplate') ? 3 : name.includes('leggings') ? 2 : name.includes('helmet') ? 1 : 1;
    }
  }
  return { pieces, totalProtection };
}

function getInventoryStats(bot) {
  const items = bot.inventory.items();
  const usedSlots = items.length;
  const totalSlots = 36;
  return {
    usedSlots,
    totalSlots,
    freeSlots: totalSlots - usedSlots,
    totalItems: items.reduce((sum, i) => sum + i.count, 0),
  };
}

const NOTABLE_BLOCKS = [
  'chest', 'trapped_chest', 'barrel', 'ender_chest', 'shulker_box',
  'crafting_table', 'furnace', 'blast_furnace', 'smoker', 'brewing_stand',
  'enchanting_table', 'anvil', 'grindstone', 'smithing_table', 'loom', 'cartography_table', 'stonecutter',
  'bed', 'spawner', 'end_portal_frame', 'nether_portal',
  'diamond_ore', 'deepslate_diamond_ore', 'emerald_ore', 'deepslate_emerald_ore',
  'ancient_debris', 'gold_ore', 'deepslate_gold_ore', 'iron_ore', 'deepslate_iron_ore',
];

function getNotableBlocks(bot) {
  const pos = bot.entity.position.floored();
  const found = [];
  for (let dx = -16; dx <= 16; dx++) {
    for (let dy = -8; dy <= 8; dy++) {
      for (let dz = -16; dz <= 16; dz++) {
        try {
          const block = bot.blockAt(pos.offset(dx, dy, dz));
          if (block && NOTABLE_BLOCKS.some(n => block.name.includes(n))) {
            found.push({
              name: block.name,
              position: { x: pos.x + dx, y: pos.y + dy, z: pos.z + dz },
              distance: Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz)),
            });
          }
        } catch (e) {}
      }
    }
  }
  found.sort((a, b) => a.distance - b.distance);
  return found.slice(0, 30);
}

function getDimension(bot) {
  try {
    if (bot.game && bot.game.dimension) {
      const dim = bot.game.dimension;
      if (dim.includes('nether')) return 'nether';
      if (dim.includes('end')) return 'the_end';
      return 'overworld';
    }
  } catch (e) {}
  return 'overworld';
}

function getTimePhase(bot) {
  const t = bot.time.timeOfDay;
  if (t >= 12541 && t <= 23458) return 'night';
  if (t >= 11616 && t < 12541) return 'sunset';
  return 'day';
}

function getActiveEffects(bot) {
  try {
    const effects = bot.entity.effects;
    if (!effects || typeof effects !== 'object') return [];
    return Object.entries(effects).map(([id, effect]) => ({
      id: parseInt(id),
      name: effect.name || `effect_${id}`,
      amplifier: effect.amplifier || 0,
      duration: effect.duration ? Math.floor(effect.duration / 20) : 0, // ticks to seconds
    }));
  } catch (e) {
    return [];
  }
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
  NOTABLE_BLOCKS,
  getNearbyPlayers,
  getNearbyEntities,
  getNearbyHostiles,
  getNearbyBlocks,
  getNotableBlocks,
  getLightLevel,
  getInventory,
  getEquipment,
  getArmorRating,
  getInventoryStats,
  getDimension,
  getTimePhase,
  getActiveEffects,
  countInventoryItem,
  hasItem,
};
