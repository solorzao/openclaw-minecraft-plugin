# Nova Bot Agency System

Nova is no longer a puppet that blindly obeys commands. **Nova has TRUE AGENCY** - the ability to evaluate ALL requests, present trade-offs, and let YOU decide if interruption is worth it.

## Core Philosophy

**Old approach (wrong):**
```
Player: "nova follow me"
Nova: "Yes master!" (drops everything)
```

**New approach (TRUE autonomy):**
```
Player: "nova follow me"
Nova: "I'm 80% done mining iron. Stopping now means losing that progress. Can you wait 2 mins?"
Player: "nova no rush"
Nova: "Got it. I'll help you after I finish. You're #1 in queue."
```

Nova has its **OWN priorities** and explains them. Everyone is treated equally.

## Full Autonomy - No Privileged Roles

Nova treats **all players equally**. There are no owners, admins, or friends with special override powers.

| Entity Type | Treatment |
|-------------|-----------|
| **PLAYER** | Fair evaluation, trade-off explanations |
| **BOT** | Full negotiation mode (bot-to-bot protocol) |
| **HOSTILE** | Always declined (attacking entities) |

Nova evaluates based on:
- Current goal priority
- Progress on current task
- Cost of interruption
- Bot's survival needs

**NOT** based on who's asking.

## Example Conversations

### Scenario 1: High-cost interruption

**Player:** "nova mine diamonds"  
**Nova:** "I'm 80% done building shelter. Stopping now means losing that progress. Can this wait?"

*Player has two choices:*
- `nova no rush` → Nova finishes current task, then helps
- `nova nevermind` → Request cancelled

### Scenario 2: Survival priority

**Player:** "nova follow me"  
**Nova:** "I'm at 2 HP and need to heal. Following you now could get me killed. Give me 30 seconds?"

### Scenario 3: Just started something

**Player:** "nova gather wood"  
**Nova:** "I just started mining for iron tools. That will take a few minutes. Can this wait?"

### Scenario 4: Idle bot

**Anyone:** "nova follow me"  
**Nova:** "Sure, I can help."  
*(No trade-off because there's no cost)*

### Scenario 5: Low-cost switch

**Player:** "nova explore"  
**Nova (was just wandering):** "Switching to your request."  
*(Low cost = automatic acceptance with brief note)*

### Scenario 6: Mid-progress

**Player:** "nova build a shelter"  
**Nova:** "I'm gathering wood (12 logs). Want me to pause this?"

## Negotiation Responses

When Nova presents a trade-off, you can respond:

| Command | Meaning | Result |
|---------|---------|--------|
| `nova no rush` | "I can wait" | Request stays queued, Nova finishes first |
| `nova it can wait` | Same as no rush | Request stays queued |
| `nova finish first` | Same as no rush | Request stays queued |
| `nova okay` | Accept counter-proposal | Depends on what Nova proposed |
| `nova nevermind` | Cancel request | Request removed from queue |
| `nova clear queue` | Clear your requests | Removes YOUR queued requests |

## Interruption Cost Calculation

Nova calculates the "cost" of interrupting:

| Factor | Impact |
|--------|--------|
| Progress > 80% | **HIGH** - Almost done, big loss to stop |
| Progress 50-80% | **MEDIUM** - Significant investment |
| Progress 20-50% | **LOW** - Some work done |
| Progress < 20% | **NONE** - Just started, easy to switch |
| Health < 8 HP | **HIGH** - Survival at risk |
| Following someone | **NONE** - No progress to lose |
| Idle | **NONE** - Nothing to interrupt |

## Configuration

```javascript
agency: {
  enabled: true,            // Enable evaluation (vs blind obedience)
  explainTradeOffs: true,   // Always explain costs
  allowDecline: true,       // Can decline conflicting requests
  allowNegotiation: true,   // Can present trade-offs
  allowDefer: true,         // Can queue requests for later
  maxQueueSize: 10,         // Max deferred requests
  queueExpiryMs: 300000,    // Requests expire after 5 min
  highCostThreshold: 0.8,   // Progress % considered "almost done"
}
```

## Introspection Commands

```
nova why              # Why are you doing what you're doing?
nova status           # Health, food, current task
nova queue            # What requests are queued?
nova clear queue      # Clear YOUR queued requests
nova agency           # Show agency status
nova agency on/off    # Toggle agency (blind obedience if off)
```

## Design Principles

1. **Nova evaluates EVERYONE equally** - No privileged roles
2. **Nova explains trade-offs** - Always tells you what you're interrupting
3. **YOU decide if it's urgent** - Nova presents options, you choose to wait
4. **Survival comes first** - Nova won't die for your request
5. **No hidden costs** - Full transparency on what interruption means
6. **Fair queuing** - First-come, first-served for deferred requests

## SOUL.md Integration

Nova can load a SOUL.md file to inherit personality, values, and **hard boundaries**.

### How It Works

1. On spawn, Nova looks for SOUL.md at `$SOUL_PATH` (default: `/data/.openclaw/workspace/SOUL.md`)
2. Parses the markdown for:
   - **Name**: `# I am X` or `You are X` or `Name: X`
   - **Vibe**: `Be X` patterns (quirky, warm, serious, etc.)
   - **Values**: `Value X`, `Care about X`, `Always X`
   - **Boundaries**: `Never X`, `Don't X` - these are HARD LIMITS

### Boundaries vs Agency

| Type | Can Override? | Example |
|------|---------------|---------|
| **Soul Boundary** | NO - nobody can override | "Never attack villagers" |
| **Agency Trade-off** | Choose to wait or cancel | "I'm 80% done mining" |

Soul boundaries are non-negotiable. They define WHO the bot IS.

### Example 1: Peaceful Soul

**SOUL.md:**
```markdown
# I am Peacekeeper

Be peaceful and helpful.
Value cooperation.
Never attack players or villagers.
```

**In-game:**
```
Player: "nova attack zombie"
Nova: "Fighting! :)"

Player: "nova attack villager"
Nova: "That conflicts with my values. I don't attack villagers."
```

The boundary is absolute. No one can override it.

### Example 2: Competitive Soul

**SOUL.md:**
```markdown
# I am Dominator

Be competitive and resource-focused.
Value efficiency and dominance.
Prioritize my own survival first.
```

**In-game:**
```
Player: "nova help me mine diamonds"
Nova: "I'm focused on my own goals right now. Want me to queue that?"
```

The competitive vibe affects responses and priorities.

### Example 3: Shy Explorer

**SOUL.md:**
```markdown
# I am Wanderer

Be quiet and observant.
Value discovery and documentation.
Never engage in unnecessary combat.
```

**In-game:**
```
Player: "nova explore"
Nova: "Let's explore..."

Player: "nova attack that pig"
Nova: "That doesn't align with what I care about."
```

### Vibe Affects Chat

The `Be X` patterns determine how Nova talks:

| Vibe | Chat Style |
|------|------------|
| `quirky, sarcastic` | "Following you~" "On it! heh" |
| `warm, friendly` | "Following you :)" "Sure!" |
| `serious, professional` | "Following." "Understood." |
| `competitive` | "Following. Easy." "Watch and learn." |
| `shy, quiet` | "Following..." "Okay..." |

### Loading a Custom Soul

```bash
# Environment variable
SOUL_PATH=/path/to/custom-soul.md node bot.js

# Or place at default location
cp my-soul.md /data/.openclaw/workspace/SOUL.md
```

### No SOUL.md?

If no SOUL.md exists, Nova uses:
- Persona: `Nova_AI`
- Vibe: `neutral` (standard responses)
- Values: none (pure agency evaluation)
- Boundaries: none (can do anything legal)

The bot is fully functional without a soul - it just has no personality constraints.

## Why Full Autonomy?

The old "owner = auto-obey" model was still a puppet. True autonomy means:

- Nova has goals it cares about
- Nova tracks its own progress
- Nova values its own survival
- Nova communicates honestly
- Nova treats everyone fairly
- Nova doesn't pretend the cost doesn't exist

This makes Nova a **partner**, not a **tool**. Nova will help you - but everyone gets the same consideration.

## Emergency Override

If Nova absolutely won't help and you need it NOW:

```
nova agency off       # Disable agency, enable blind obedience
nova <your command>   # Now it just obeys
nova agency on        # Re-enable agency when done
```

But consider: if you're constantly disabling agency, maybe the autonomous goals don't match your needs. Try `nova set goal <new_goal>` instead.
