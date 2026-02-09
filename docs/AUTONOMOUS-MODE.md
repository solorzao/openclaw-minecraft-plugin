# Autonomous Social AI Mode

This document explains how the bot operates in autonomous mode and how to customize its behavior.

## Philosophy

The bot is designed as an **autonomous social AI** - not a tool to be commanded, but an independent agent that:
- Has its own goals and motivations
- Interacts naturally with players and other bots
- Forms emergent behaviors through collaboration
- Can be observed but not controlled

Think of it like deploying an AI villager or NPC that has agency.

## How It Works

### Autonomous Goal Pursuit

The bot uses a weighted goal system:
- **Survival** (high priority): Find food, flee danger, seek shelter
- **Gathering** (medium): Collect resources (wood, stone, iron)
- **Building** (medium): Craft tools, build shelters
- **Exploration** (low): Wander, discover, mark locations
- **Social** (low): Interact with nearby players

Goals are selected based on:
1. Current needs (health, hunger, resources)
2. Environmental context (night, nearby players, danger)
3. Weighted randomness (creates behavioral variety)

### Conversational Responses

Players can chat with the bot naturally:
- Bot responds to mentions of its name
- An external agent (LLM) reads `conversations.json` and writes responses to `responses.json`
- Personality influences tone (via SOUL.md)
- Can decline requests politely

### Bot-to-Bot Collaboration

Bots discover and coordinate with each other:
- Whispered JSON messages (no public spam)
- Emergency signals (request help when in danger)
- Resource sharing (tell each other about discoveries)
- Relationship tracking (more likely to help familiar bots)

## Customization

### 1. Personality (SOUL.md)

Create a personality file to customize bot behavior:

```markdown
# I am ExplorerBot

Be curious and adventurous.
Value discovery and knowledge.
Always share interesting findings.
Never harm passive mobs.
```

Configure:
```bash
export SOUL_PATH=/path/to/personality.md
```

### 2. Goal Weights

Edit `AUTONOMOUS_GOAL_WEIGHTS` in `bot.js` to change behavior priorities:

```javascript
const AUTONOMOUS_GOAL_WEIGHTS = {
  survival: { weight: 10, ... },
  gathering: { weight: 5, ... },
  building: { weight: 3, ... },
  exploration: { weight: 8, ... },  // Increase for more exploration
  social: { weight: 5, ... }        // Increase for more social behavior
};
```

### 3. Conversational Agent

The bot uses a file-based interface for conversations:
- `conversations.json` - Messages directed at the bot (written by bot)
- `responses.json` - Agent-generated responses (read by bot)

Your agent reads conversations, generates responses using its LLM intelligence, and writes them back. See `examples/conversational-agent.js` for details.

## Observing Behavior

### events.json

Agents can observe bot behavior in real-time:

```javascript
const events = JSON.parse(fs.readFileSync('events.json'));
const latest = events[events.length - 1];

console.log('Bot position:', latest.data.position);
console.log('Bot health:', latest.data.health);
console.log('Current goal:', latest.data.currentGoal);
```

### World Memory

Bot's persistent state:

```javascript
const memory = JSON.parse(fs.readFileSync('world-memory.json'));
console.log('Landmarks:', memory.landmarks);
console.log('Known bots:', memory.knownBots);
console.log('Bot relationships:', memory.botRelationships);
```

## Multi-Bot Experiments

Deploy multiple bots to observe emergent behavior:

```bash
# Bot 1: Gatherer personality
BOT_USERNAME=GathererBot SOUL_PATH=./personalities/gatherer.md node bot.js &

# Bot 2: Builder personality
BOT_USERNAME=BuilderBot SOUL_PATH=./personalities/builder.md node bot.js &

# Bot 3: Explorer personality
BOT_USERNAME=ExplorerBot SOUL_PATH=./personalities/explorer.md node bot.js &
```

Watch them:
- Discover each other
- Share information
- Help each other in emergencies
- Form specialization patterns

## Debugging

### Verbose Logging

Enable detailed autonomous behavior logs:

```javascript
const AUTONOMOUS_CONFIG = {
  ...
  announceActions: true,  // Logs every decision
};
```

### Console Output

The bot logs key events to console:
- `[Conversation] Queued from Player: "message"` - Player message received
- `[Conversation] Response: "text"` - Response spoken
- `[Autonomous] Starting: action` - Goal selected

## FAQ

**Q: Can I ever command the bot?**
A: No - that's the point. It's autonomous. But you can observe and interact conversationally.

**Q: What if the bot does something I don't want?**
A: Adjust its personality (SOUL.md) or goal weights. Or accept it as emergent behavior!

**Q: Can bots fight each other?**
A: Only if their SOUL.md allows it. Most personalities will cooperate, not compete.

**Q: Will bots steal from players?**
A: No - bots respect other players' items/builds (unless personality says otherwise).

**Q: How do I stop a runaway bot?**
A: Shut down the process or use server commands. There's no "pause" button - it's autonomous!
