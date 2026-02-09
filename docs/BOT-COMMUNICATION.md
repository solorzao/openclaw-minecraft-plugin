# Bot-to-Bot Communication

**Phase 21** - Multi-agent coordination using Minecraft's whisper system with structured JSON messages.

## Overview

Bots coordinate with each other using Minecraft's whisper system. Messages between bots use structured JSON format, while messages from humans are processed as natural language.

## Discovery

When a bot spawns, it announces itself with:
```
🤖 BOT_ANNOUNCE
```

Other bots listen for this message and register the sender. This creates a mesh network of awareness - bots automatically discover each other.

**Commands:**
- `nova bots` - List all known bots on the server

## Message Protocol

All bot-to-bot messages use this JSON structure:
```json
{
  "type": "request|response|announcement|claim|emergency|ack",
  "from": "sender_username",
  "timestamp": 1707420000000,
  "content": { ... }
}
```

### Message Types

| Type | Purpose | Content Fields |
|------|---------|----------------|
| `request` | Ask another bot for help | `requestId`, `action`, `params` |
| `response` | Reply to a request | `requestId`, `decision`, `reason`, `response`, `counterProposal` |
| `negotiation` | Counter-proposal | `proposal`, `alternativeAction` |
| `announcement` | Share discoveries | `type`, `location`, `message` |
| `claim` | Mark territory/resources | `resource`, `location`, `timestamp` |
| `emergency` | Urgent help needed | `reason`, `location` |
| `ack` | Acknowledge receipt | `acknowledged`, `message` |

## Chat Commands

### Request Help
```
nova ask <bot_name> to <action>
```
Example: `nova ask Bot_B to mine diamonds`

### Announce Discovery
```
nova announce <message>
```
Broadcasts to all known bots with current location.

Example: `nova announce Found a village with librarians!`

### Claim Resource
```
nova claim <resource_name>
```
Claims the current location/area for a resource.

Example: `nova claim diamond_mining`

### View Claims
```
nova claims
```
Shows all claims from all bots.

### Emergency Signal
```
nova emergency
```
Sends emergency beacon to all bots. Bots with health > 10 and no active goal will respond.

### Whisper to Bot
```
nova whisper <bot_name> <message>
```
Sends a direct message (structured for bots, regular whisper for humans).

## Integration with Agency System

Bot requests are evaluated the same as player requests:

1. **Request received** via whisper
2. **Agency evaluates** using existing `evaluateRequest()` system
3. **Decision made** (accept/decline/defer/negotiate)
4. **Response sent** back to requesting bot
5. **Action executed** if accepted

Trust level for bots is `TRUST_LEVELS.BOT` - they can negotiate but have lower priority than owners/friends.

## World Memory

Bot-related data is persisted:
- `worldMemory.knownBots` - Array of discovered bot usernames
- `worldMemory.claims` - Object of bot claims `{ username: claim_data }`
- Bot discoveries are saved as landmarks: `{username}_discovery`

## Examples

### Bot A needs help mining:
```javascript
// Bot A sends:
sendMessageToBot('Bot_B', 'request', {
  requestId: Date.now(),
  action: 'help_mine',
  params: {
    resource: 'diamonds',
    location: { x: 10, y: -58, z: 20 }
  }
});

// Bot B evaluates and responds:
// → Accept: "On my way!"
// → Decline: "I'm too far away."
// → Defer: "I'll help when I finish building."
// → Negotiate: "Help me gather wood first?"
```

### Bot discovers a village:
```javascript
announceDiscovery('village', { x: 100, y: 64, z: 200 }, 'Found a village with a blacksmith!');
// All bots receive and mark location in their world memory
```

### Bot under attack:
```javascript
sendEmergency('zombie_attack', bot.entity.position);
// Nearby bots with health > 10 and no current goal may respond
```

### Claiming a mine:
```javascript
claimResource('iron_mine', { x: 50, y: 30, z: -100 });
// Other bots see the claim and can avoid the area
```

## Emergent Behaviors

This system enables multi-agent emergent behaviors:

1. **Cooperative Mining** - Bots can share resource locations and help each other mine
2. **Territorial Awareness** - Claims prevent bots from competing for the same resources
3. **Emergency Response** - Bots form ad-hoc rescue teams when one is in danger
4. **Knowledge Sharing** - Discoveries (villages, dungeons, etc.) are shared across the network
5. **Negotiated Cooperation** - Bots can negotiate who does what based on their current goals

## Debugging

Check events file for bot communication logs:
- `bot_message_sent` - Outgoing messages
- `bot_message_received` - Incoming messages
- `bot_announcement_saved` - Saved discoveries
- `bot_claim_received` - Received claims
- `bot_emergency_received` - Emergency signals

Console shows emoji-prefixed messages:
- `🤖` - Bot discovery
- `💬` - Whisper received
- `📢` - Announcement
- `🚩` - Claim
- `🚨` - Emergency
- `🤝` - Negotiation
