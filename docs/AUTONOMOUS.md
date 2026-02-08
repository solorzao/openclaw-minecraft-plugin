# Autonomous Behavior System with Agency

**Phase 20** - The bot has TRUE AUTONOMY. It evaluates all requests and decides whether to accept, decline, defer, or negotiate.

## Philosophy

The bot is **not a puppet**. It's a collaborative agent with:

- **Own goals** - It pursues objectives independently
- **Decision-making** - It evaluates every request before acting
- **Negotiation** - It can counter-propose alternatives
- **Reasoning** - It explains why it makes decisions
- **Trust system** - It treats different players differently

## Quick Start

```
nova trust me         # Become the bot's owner
nova auto             # Check autonomous status
nova why              # Ask bot to explain its current action
nova follow           # Request (bot will evaluate and respond)
```

## The Agency System

### How It Works

When anyone makes a request, the bot runs `evaluateRequest()`:

```
Request received
    ↓
Evaluate: urgency, trust level, alignment with goals, resources
    ↓
Decision: ACCEPT / DECLINE / DEFER / NEGOTIATE
    ↓
Respond with reasoning
```

### Decision Types

| Decision | Meaning | Example Response |
|----------|---------|------------------|
| **ACCEPT** | Do it now | "On it!" / "Following you!" |
| **DECLINE** | Won't do it | "No." / "I'm not sure about that." |
| **DEFER** | Will do it later | "I'll help after I finish resources." |
| **NEGOTIATE** | Counter-proposal | "I need iron tools first. Help me find iron?" |

### Decision Criteria

1. **Urgency** - Is someone dying? Emergency keywords?
2. **Trust Level** - Owner? Friend? Stranger? Hostile?
3. **Goal Alignment** - Does request fit current phase?
4. **Self-Preservation** - Can I afford to help? Health/food ok?
5. **Resource Cost** - How much will this cost me?

## Trust System

The bot treats players differently based on trust:

| Trust Level | Behavior |
|-------------|----------|
| **OWNER** | High priority, explains reasoning, almost always accepts |
| **FRIEND** | Helpful, negotiates when busy |
| **NEUTRAL** | Cautious, defers costly requests, skeptical |
| **BOT** | Negotiates as equals, seeks mutual benefit |
| **HOSTILE** | Declines all requests |

### Setting Trust

```
nova trust me                    # Claim ownership (first player only)
nova trust PlayerName friend     # Owner sets someone as friend
nova trust PlayerName hostile    # Owner marks someone hostile
nova who trusts                  # List all trust relationships
```

## Example Interactions

### Aligned Request (Accept)
```
Player: nova mine iron
Bot: [resources] need iron     # Aligns with current phase
     *starts mining*
```

### Unaligned Request from Owner (Accept with note)
```
Owner: nova follow me
Bot: Sure! (pausing resources for now)
     *follows owner*
```

### Request from Stranger (Negotiate)
```
Stranger: nova mine diamonds
Bot: I'm working on my own goals. What's in it for me?
```

### Request When Unable (Defer)
```
Player: nova help fight!
Bot: I'm at low health - give me a moment.
     *eats food first, then helps*
```

### Bot-to-Bot Negotiation
```
Bot_B: nova help gather wood
Nova: I'm focused on resources right now. Can this wait?
      *or*
Nova: Coordinating with you. *helps because it aligns*
```

## Commands

### Agency Commands

| Command | Description |
|---------|-------------|
| `nova why` / `nova explain` | Explain current action and reasoning |
| `nova queue` | Show deferred requests |
| `nova clear queue` | Clear queued requests (owner/friend only) |
| `nova trust me` | Claim ownership |
| `nova trust <player> <level>` | Set trust (owner only) |
| `nova who trusts` | List trust relationships |

### Autonomous Commands

| Command | Description |
|---------|-------------|
| `nova auto` | Show status + your trust level |
| `nova auto on/off` | Enable/disable autonomous behavior |
| `nova set goal <name>` | Change current goal |
| `nova goals` | List available goals |
| `nova phase` | Show current phase |
| `nova progress` | Show detailed stats |
| `nova stop` | Stop current action, clear queue |

## Goal System

### Default Goal: `thriving_survivor`

1. **Survival** → 2. **Home** → 3. **Resources** → 4. **Crafting** → 5. **Exploration** → 6. **Thriving**

Each phase has specific objectives. The bot evaluates requests based on whether they align with the current phase.

### Available Goals

| Goal | Focus | Phases |
|------|-------|--------|
| `thriving_survivor` | Balanced gameplay | survival → home → resources → crafting → exploration → thriving |
| `peaceful_farmer` | Farming & animals | survival → home → farming → animals → thriving |
| `explorer` | World discovery | survival → resources → exploration → documentation |
| `builder` | Construction | survival → resources → crafting → building → decoration |
| `wealthy_trader` | Emeralds & trading | survival → resources → trading → wealth |
| `take_over_server` | Dominance | survival → resources → crafting → fortification → dominance |

## Request Queue

When the bot defers a request, it's added to a queue:

```javascript
requestQueue = [
  { request: { action: 'follow', username: 'Player1' }, requester: 'Player1', queuedAt: timestamp },
  { request: { action: 'mine_resource', resource: 'diamond' }, requester: 'Player2', queuedAt: timestamp }
]
```

- Queued requests are processed when the bot becomes idle
- Requests expire after 5 minutes
- Owner/friends can clear the queue with `nova clear queue`

## Configuration

In `config/default.json`:

```json
{
  "autonomous": {
    "enabled": true,
    "defaultGoal": "thriving_survivor",
    "checkIntervalMs": 10000,
    "announceActions": true,
    "helpNearbyPlayers": true,
    "helpRadius": 20
  }
}
```

## Events

The agency system logs detailed events:

| Event | Description |
|-------|-------------|
| `evaluating_request` | Request evaluation started (with all criteria) |
| `request_decision` | Decision made (accept/decline/defer/negotiate) |
| `request_queued` | Request added to defer queue |
| `processing_queued_request` | Processing a deferred request |
| `pausing_autonomous` | Autonomous goal paused for external request |
| `autonomous_action` | Autonomous action taken with reasoning |

## Multi-Bot Coordination

When bots interact, they negotiate as equals:

```
Bot_A: "Help me gather wood?"
Bot_B evaluates:
  - Trust: BOT (negotiate)
  - Alignment: gathering aligns with resources phase
  - Decision: ACCEPT (mutual benefit)
Bot_B: "Coordinating with you."
```

Or if busy:
```
Bot_B evaluates:
  - Trust: BOT
  - Current goal: mining iron (high priority)
  - Decision: NEGOTIATE
Bot_B: "I'm focused on resources right now. Can this wait?"
```

## Design Principles

1. **Agency over obedience** - Bot decides, doesn't just execute
2. **Transparent reasoning** - Bot explains why it does things
3. **Trust-based relationships** - Different treatment for different entities
4. **Self-preservation** - Bot prioritizes its own survival
5. **Collaborative not subservient** - Bot negotiates, proposes alternatives
6. **Goal-directed** - Always working toward something

## Extending

### Adding Custom Trust Logic

In `evaluateRequest()`, add conditions:

```javascript
// Example: Always help players who are low health
if (requesterHealth < 6) {
  return { type: DECISION.ACCEPT, reason: 'emergency_help', response: "You need help!" };
}
```

### Adding New Decision Criteria

```javascript
function evaluateRequest(request, requester) {
  // Add new criteria
  const timeOfDay = bot.time.timeOfDay;
  const isNight = timeOfDay >= 13000;
  
  if (isNight && request.action === 'explore') {
    return {
      type: DECISION.DEFER,
      reason: 'too_dangerous_at_night',
      response: "Let's wait for daylight. Too dangerous now."
    };
  }
  // ... rest of evaluation
}
```

## Troubleshooting

### Bot ignores my commands
- Check your trust level: `nova auto`
- Claim ownership: `nova trust me`
- Bot may be declining because request doesn't align

### Bot keeps saying "I'm busy"
- Check what it's doing: `nova why`
- Check queue: `nova queue`
- Force stop: `nova stop`

### Bot won't negotiate
- Your trust level may be HOSTILE
- Ask owner to set your trust: `nova trust YourName friend`
