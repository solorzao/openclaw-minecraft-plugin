# OpenClaw Deployment Guide

**How to integrate the Minecraft bot with OpenClaw agents**

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     OpenClaw Agent                       │
│  ┌──────────────┐    ┌──────────────┐   ┌────────────┐ │
│  │ Main Session │    │  Sub-Agent   │   │  Cron Job  │ │
│  │  (Discord)   │───>│ (Controller) │<─>│(Heartbeat) │ │
│  └──────────────┘    └──────┬───────┘   └────────────┘ │
└─────────────────────────────│─────────────────────────┘
                              │
                    file-based communication
                              │
           ┌──────────────────┴──────────────────┐
           ▼                                      ▼
      events.json                           commands.json
           │                                      │
           └────────────> bot.js <───────────────┘
                              │
                              ▼
                      Minecraft Server
```

---

## Method 1: Sub-Agent Controller (Recommended)

Use OpenClaw's `sessions_spawn` to run a dedicated controller agent.

### Step 1: Start the Bot

```bash
cd /path/to/openclaw-minecraft-plugin
npm install
npm start &  # Run in background
```

Bot will create:
- `events.json` - Updated every 3 seconds
- `commands.json` - Read every 750ms
- `world-memory.json` - Persistent landmarks

### Step 2: Spawn Controller Agent

From your main OpenClaw session:

```javascript
sessions_spawn({
  task: `You control a Minecraft bot via file-based commands.

**Your Files:**
- Read: /path/to/openclaw-minecraft-plugin/events.json (bot state)
- Write: /path/to/openclaw-minecraft-plugin/commands.json (actions)

**Your Goal:** Keep the bot alive and help the player.

**Priority Logic:**
1. DANGER: health < 6 → retreat/hide
2. HUNGER: food < 6 → find_food, cook_food, eat
3. COMBAT: hostileMobs nearby + health > 10 → attack
4. SOCIAL: player nearby → follow player
5. IDLE: explore or gather resources

**Example Commands:**
- Follow player: {"action":"follow","username":"Wookiee_23","distance":2}
- Find food: {"action":"find_food"}
- Attack: {"action":"attack"}
- Craft pickaxe: {"action":"craft","item":"wooden_pickaxe"}

Read events.json every 10 seconds, decide actions, write commands.json.
Run monitoring loop continuously.`,
  
  label: 'minecraft-bot-controller',
  model: 'ollama/llama3.2',  // Local model for low cost
  cleanup: 'keep'  // Keep session alive
});
```

### Step 3: Monitor

```javascript
// Check controller status
sessions_list({ kinds: ['other'], messageLimit: 3 });

// View latest commands
exec('tail -20 /path/to/openclaw-minecraft-plugin/commands.json');

// View bot events
exec('tail -50 /path/to/openclaw-minecraft-plugin/events.json | grep perception | tail -5');
```

---

## Method 2: Cron Job Heartbeat

Use OpenClaw's cron system for periodic checks.

### Create Heartbeat Job

```javascript
cron({
  action: 'add',
  job: {
    name: 'Minecraft Bot Heartbeat',
    schedule: {
      kind: 'every',
      everyMs: 30000,  // Every 30 seconds
      anchorMs: Date.now()
    },
    payload: {
      kind: 'agentTurn',
      message: `Check Minecraft bot state and issue commands if needed.

Read /path/to/openclaw-minecraft-plugin/events.json.
If bot needs help (low health, low food, combat), write commands to commands.json.

ONLY respond if action needed. Otherwise reply: HEARTBEAT_OK`,
      model: 'ollama/llama3.2',
      timeoutSeconds: 20
    },
    sessionTarget: 'isolated',
    enabled: true
  }
});
```

---

## Method 3: Custom Script

Write a simple Node.js controller.

### `controller.js`

```javascript
const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, 'events.json');
const COMMANDS_FILE = path.join(__dirname, 'commands.json');

function readEvents() {
  try {
    return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeCommands(commands) {
  fs.writeFileSync(COMMANDS_FILE, JSON.stringify(commands, null, 2));
}

function decide(perception) {
  const { health, food, hungerUrgency, hostileMobs, nearbyPlayers } = perception.data;
  
  // Priority 1: Danger
  if (health < 6) {
    console.log('🚨 LOW HEALTH - Retreating!');
    return [{ action: 'stop' }];
  }
  
  // Priority 2: Hunger
  if (hungerUrgency === 'critical' || food < 6) {
    console.log('🍖 HUNGRY - Finding food...');
    return [{ action: 'find_food' }];
  }
  
  // Priority 3: Combat
  if (hostileMobs.length > 0 && health > 10) {
    const nearest = hostileMobs[0];
    console.log(`⚔️  COMBAT - Attacking ${nearest.type}...`);
    return [{ action: 'attack', target: nearest.type }];
  }
  
  // Priority 4: Social
  if (nearbyPlayers.length > 0) {
    const player = nearbyPlayers[0];
    if (player.distance > 3) {
      console.log(`👥 SOCIAL - Following ${player.username}...`);
      return [{ action: 'follow', username: player.username, distance: 2 }];
    }
  }
  
  // Priority 5: Idle
  console.log('🌍 IDLE - Exploring...');
  return [{ action: 'goal', goal: 'explore' }];
}

function main() {
  console.log('🤖 Minecraft Bot Controller Started');
  
  setInterval(() => {
    const events = readEvents();
    if (events.length === 0) return;
    
    const latest = events[events.length - 1];
    
    if (latest.type === 'perception') {
      const commands = decide(latest);
      writeCommands(commands);
      
      const { health, food, position } = latest.data;
      console.log(`📊 HP:${health} Food:${food} Pos:(${position.x},${position.y},${position.z})`);
    }
  }, 10000);  // Every 10 seconds
}

main();
```

### Run Controller

```bash
node controller.js &
```

---

## Integration Patterns

### Pattern 1: Manual Control via Discord

User says in Discord: `"nova, mine some coal"`

OpenClaw agent:
1. Parses intent: mine coal
2. Writes command: `{"action":"mine_resource","resource":"coal","count":10}`
3. Bot executes and reports back via events

### Pattern 2: Autonomous Survival

Sub-agent monitors events continuously:
- `food < 6` → find_food
- `health < 10` → retreat to safety
- `nightfall` → find bed, sleep
- `player nearby` → follow and assist

### Pattern 3: Task Delegation

Main session delegates long tasks:

```javascript
sessions_spawn({
  task: 'Build a shelter at (-50, 64, 120) using cobblestone. Bot control files at /path/to/plugin/',
  label: 'build-shelter-task'
});
```

Sub-agent:
1. Writes commands: goto → mine stone → craft → build
2. Monitors progress via events
3. Reports completion to main session

---

## Advanced: Multi-Bot Coordination

Run multiple bots with unique file sets:

```bash
# Bot 1: Miner
node bot.js --name Miner_AI --events miner-events.json --commands miner-commands.json &

# Bot 2: Builder
node bot.js --name Builder_AI --events builder-events.json --commands builder-commands.json &
```

Controller coordinates:
- Miner_AI gathers resources
- Builder_AI constructs structures
- Share via chest storage system

---

## Debugging

### Check Bot Status

```bash
# Is bot running?
ps aux | grep bot.js

# View recent events
tail -50 events.json | jq '.[] | select(.type=="perception") | .data | {health, food, position}'

# View command queue
cat commands.json | jq

# Bot logs
tail -f bot-output.log
```

### Common Issues

**Bot not responding:**
- Check `commands.json` exists and is valid JSON
- Verify bot process is running
- Check Minecraft server connection

**Bot stuck:**
- Write `{"action":"stop"}` to reset
- Check `currentGoal` in perception events
- Bot may be pathfinding (wait for completion)

**Bot dying:**
- Controller not checking health/food
- Increase monitoring frequency
- Add priority logic (health > food > combat)

---

## Performance Tips

### Local Model for Controller

Use Ollama for zero-cost operation:

```javascript
sessions_spawn({
  model: 'ollama/llama3.2',  // ~3B params, fast, free
  task: '...'
});
```

### Batch Commands

Write multiple commands at once:

```json
[
  {"action":"goto","x":10,"y":64,"z":20},
  {"action":"mine","resource":"coal"},
  {"action":"goto_mark","name":"home"}
]
```

Bot executes sequentially.

### Reduce Event Polling

Increase perception interval in `bot.js`:

```javascript
setInterval(updatePerception, 5000);  // Default: 3000ms
```

---

## Production Deployment

### Systemd Service

`/etc/systemd/system/minecraft-bot.service`:

```ini
[Unit]
Description=OpenClaw Minecraft Bot
After=network.target

[Service]
Type=simple
User=minecraft
WorkingDirectory=/opt/openclaw-minecraft-plugin
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl enable minecraft-bot
sudo systemctl start minecraft-bot
sudo systemctl status minecraft-bot
```

### Docker Container

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "bot.js"]
```

Build & run:

```bash
docker build -t minecraft-bot .
docker run -d \
  -v $(pwd)/events.json:/app/events.json \
  -v $(pwd)/commands.json:/app/commands.json \
  -v $(pwd)/world-memory.json:/app/world-memory.json \
  --name minecraft-bot \
  minecraft-bot
```

---

## Security Considerations

### File Permissions

```bash
chmod 600 events.json commands.json world-memory.json
chown openclaw:openclaw *.json
```

### Sandboxing

Run bot with limited privileges:

```bash
sudo -u minecraft node bot.js
```

### Server Whitelist

Enable Minecraft server whitelist to prevent unauthorized bots.

---

**Next Steps:**
1. Deploy bot + controller
2. Test basic commands
3. Implement priority logic
4. Monitor and tune

See [INTERFACE.md](INTERFACE.md) for complete command/event reference.

---

**Last Updated:** 2026-02-08
