# OpenClaw Deployment Guide

**How to integrate the Minecraft bot with OpenClaw agents**

## Architecture

```
+---------------------------------------------------------+
|                     OpenClaw Agent                       |
|  +--------------+    +--------------+   +------------+  |
|  | Main Session |    |  Sub-Agent   |   |  Cron Job  |  |
|  |  (Discord)   |--->| (Controller) |<->|(Heartbeat) |  |
|  +--------------+    +------+-------+   +------------+  |
+-----------------------------|---------------------------+
                              |
                    file-based communication
                              |
           +------------------+------------------+
           v                  v                  v
      state.json         events.json       commands.json
           |                  |                  |
           +--------> src/index.js <-------------+
                              |
                              v
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

Bot will create in `data/`:
- `state.json` - Updated every 1 second
- `events.json` - Rolling event log
- `commands.json` - Read every 500ms

### Step 2: Spawn Controller Agent

From your main OpenClaw session:

```javascript
sessions_spawn({
  task: `You control a Minecraft bot via file-based commands.

**Your Files:**
- Read: /path/to/openclaw-minecraft-plugin/data/state.json (bot state, updated every 1s)
- Read: /path/to/openclaw-minecraft-plugin/data/events.json (game events, command results)
- Write: /path/to/openclaw-minecraft-plugin/data/commands.json (actions)

**Your Goal:** Keep the bot alive and help the player.

**Priority Logic:**
1. DANGER: health < 6 -> stop, find safety
2. HUNGER: food < 6 -> eat (if have food) or find_food
3. COMBAT: hostile entities nearby + health > 10 -> attack
4. SOCIAL: player nearby -> follow player
5. IDLE: explore or gather resources

**Example Commands (include unique id for each):**
- Follow player: {"id":"f1","action":"follow","username":"Wookiee_23","distance":2}
- Find food: {"id":"f2","action":"find_food"}
- Attack: {"id":"a1","action":"attack"}
- Craft: {"id":"c1","action":"craft","item":"wooden_pickaxe"}

Read state.json every 5 seconds, decide actions, write commands.json.`,

  label: 'minecraft-bot-controller',
  cleanup: 'keep'
});
```

### Step 3: Monitor

```javascript
// Check controller status
sessions_list({ kinds: ['other'], messageLimit: 3 });

// View bot state
read_file('/path/to/openclaw-minecraft-plugin/data/state.json');

// View recent command results
read_file('/path/to/openclaw-minecraft-plugin/data/events.json');
```

---

## Method 2: Cron Job Heartbeat

Use OpenClaw's cron system for periodic checks.

```javascript
cron({
  action: 'add',
  job: {
    name: 'Minecraft Bot Heartbeat',
    schedule: {
      kind: 'every',
      everyMs: 30000,
      anchorMs: Date.now()
    },
    payload: {
      kind: 'agentTurn',
      message: `Check Minecraft bot state at /path/to/data/state.json.
If bot needs help (low health, low food, combat), write commands to /path/to/data/commands.json.
ONLY respond if action needed. Otherwise reply: HEARTBEAT_OK`,
      timeoutSeconds: 20
    },
    sessionTarget: 'isolated',
    enabled: true
  }
});
```

---

## Method 3: Custom Script

See [`examples/basic-controller.js`](../examples/basic-controller.js) for a standalone Node.js controller.

```bash
# Start bot
npm start &

# Start controller
node examples/basic-controller.js
```

---

## Integration Patterns

### Pattern 1: Manual Control via Discord

User says: `"mine some coal"`

OpenClaw agent:
1. Reads `state.json` to check bot status
2. Writes: `[{"id":"mine-1","action":"mine_resource","resource":"coal_ore","count":10}]`
3. Monitors `events.json` for `command_result` with `commandId: "mine-1"`
4. Reports result back to user

### Pattern 2: Autonomous Survival

Sub-agent monitors `state.json` continuously:
- `food < 6` -> eat or find_food
- `health < 10` -> stop, retreat
- `time.phase === "night"` -> sleep
- `nearbyEntities` has hostiles -> attack or flee

### Pattern 3: Task Delegation

Main session delegates long tasks:

```javascript
sessions_spawn({
  task: 'Build a shelter using the Minecraft bot. Files at /path/to/data/. Use build command with shelter_3x3 template.',
  label: 'build-shelter-task'
});
```

---

## Multi-Bot Setup

Run multiple bots with separate data directories:

```bash
# Bot 1: Miner
BOT_USERNAME=Miner_AI BOT_DATA_DIR=./data-miner npm start &

# Bot 2: Builder
BOT_USERNAME=Builder_AI BOT_DATA_DIR=./data-builder npm start &
```

Each bot gets its own `state.json`, `events.json`, and `commands.json`.

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
Environment="BOT_USERNAME=MyBot_AI"
Environment="MC_HOST=server.address.com"
Environment="MC_PORT=25565"
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "src/index.js"]
```

```bash
docker build -t minecraft-bot .
docker run -d \
  -e BOT_USERNAME=MyBot_AI \
  -e MC_HOST=server.address.com \
  -v $(pwd)/data:/app/data \
  --name minecraft-bot \
  minecraft-bot
```

Mount the `data/` directory so the agent can access IPC files from the host.

---

## Debugging

```bash
# Check if bot is running
ps aux | grep "src/index.js"

# View current state
cat data/state.json | jq '.bot | {health, food, position}'

# View recent events
cat data/events.json | jq '.[-5:]'

# Send a test command
echo '[{"id":"test","action":"chat","message":"Hello!"}]' > data/commands.json

# Check command result
cat data/events.json | jq '.[] | select(.commandId=="test")'
```

### Common Issues

**Bot not responding to commands:**
- Check `data/commands.json` exists and is valid JSON
- Verify bot process is running
- Bot polls every 500ms - wait a moment

**Bot stuck pathfinding:**
- Send `{"action":"stop"}` to reset
- Check `state.json` `currentAction` field

**Bot dying repeatedly:**
- Controller not checking health/food frequently enough
- Increase check frequency or add priority logic
