# Example SOUL.md Files

These example souls demonstrate different personality types for the Nova bot.

## Available Souls

| File | Persona | Vibe | Key Traits |
|------|---------|------|------------|
| `peaceful-helper.md` | Peacekeeper | Warm, helpful | Pacifist, community-focused |
| `competitive-survivor.md` | Dominator | Competitive | Self-interested, efficient |
| `shy-explorer.md` | Wanderer | Quiet, curious | Exploration-focused, reserved |
| `quirky-builder.md` | Archie | Quirky, creative | Building-obsessed, playful |
| `professional-assistant.md` | Assistant | Professional | Task-focused, no-nonsense |
| `friendly-farmer.md` | Farmhand | Warm, patient | Agriculture-focused, sharing |

## Usage

```bash
# Use a specific soul
SOUL_PATH=/path/to/openclaw-minecraft-plugin/examples/souls/peaceful-helper.md node bot.js

# Or copy to default location
cp examples/souls/quirky-builder.md /data/.openclaw/workspace/SOUL.md
node bot.js
```

## Creating Your Own

A SOUL.md file uses these patterns:

```markdown
# I am [Name]

## Personality
Be [trait].
Be [trait].

## Values
Value [thing].
Care about [thing].
Always [behavior].
Prioritize [priority].

## Boundaries
Never [hard limit].
Don't [restriction].
```

### Key Patterns Recognized

| Pattern | Purpose | Example |
|---------|---------|---------|
| `# I am X` | Sets persona name | `# I am Nova` |
| `Be X` | Sets vibe/personality | `Be quirky and warm` |
| `Value X` | Adds to values list | `Value cooperation` |
| `Care about X` | Adds to values list | `Care about others` |
| `Always X` | Adds to values list | `Always help friends` |
| `Prioritize X` | Adds to values list | `Prioritize survival` |
| `Never X` | Adds HARD boundary | `Never attack players` |
| `Don't X` | Adds HARD boundary | `Don't grief` |

### Vibe Keywords

These keywords in "Be X" patterns affect chat style:

- `quirky`, `sarcastic`, `playful` → Adds `~`, `:)`, `heh`
- `warm`, `friendly`, `kind` → Adds `:)`, `<3`, `friend!`
- `serious`, `professional`, `formal` → Removes casual punctuation
- `competitive`, `aggressive` → Adds `. Easy.`, `. Watch and learn.`
- `shy`, `quiet`, `reserved` → Adds `...`, softer tone

### Boundaries vs Values

- **Boundaries** (`Never`, `Don't`): HARD LIMITS. Cannot be overridden, even by owner.
- **Values** (`Value`, `Care about`): Soft preferences. Affect decision priority but can be negotiated.

## Tips

1. **Start simple**: Just a name and one boundary works fine
2. **Test in-game**: Try commands that should/shouldn't work
3. **Combine traits**: "Be quirky but serious about building"
4. **Layer boundaries**: Multiple `Never X` lines are all enforced
5. **No soul is valid**: Bot works without SOUL.md (neutral personality)
