/**
 * Conversational Agent - Bot's "Mind"
 *
 * The OpenClaw agent IS an LLM (Claude/GPT/etc).
 * It reads conversations.json and generates responses using its own intelligence.
 *
 * ARCHITECTURE:
 *   bot.js writes to conversations.json when a player mentions the bot.
 *   This agent reads conversations.json and writes responses to responses.json.
 *   bot.js reads responses.json and speaks the responses in-game.
 *
 * USAGE from OpenClaw agent:
 *   await sessions_spawn({
 *     task: `Control ${bot.username}'s conversations using your LLM intelligence.`,
 *     label: "minecraft-conversations"
 *   });
 */

const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || '/data/minecraft-bot';
const CONVERSATIONS_FILE = `${DATA_DIR}/conversations.json`;
const RESPONSES_FILE = `${DATA_DIR}/responses.json`;
const SOUL_FILE = process.env.SOUL_PATH || `${DATA_DIR}/SOUL.md`;

// Load personality if available
let personality = '';
try {
  personality = fs.readFileSync(SOUL_FILE, 'utf8');
} catch {
  console.log('No SOUL.md found - using default personality');
}

/**
 * Main agent loop - read conversations, generate responses
 */
setInterval(() => {
  try {
    if (!fs.existsSync(CONVERSATIONS_FILE)) return;

    const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf8');
    if (!data.trim()) return;

    const conversations = JSON.parse(data);
    if (!Array.isArray(conversations) || conversations.length === 0) return;

    const responses = [];

    for (const convo of conversations) {
      // Agent IS the LLM - directly generates response
      const response = generateNaturalResponse(convo);
      if (response) {
        responses.push({ conversationId: convo.id, text: response });
      }
    }

    if (responses.length > 0) {
      fs.writeFileSync(RESPONSES_FILE, JSON.stringify(responses, null, 2));
    }
  } catch (err) {
    console.error('Conversation processing error:', err.message);
  }
}, 2000);

/**
 * Agent uses its own LLM intelligence to understand and respond.
 * No hardcoded patterns - the agent naturally understands language.
 *
 * In a real OpenClaw agent (Claude/GPT), THIS is where the LLM comes in.
 * The agent understands the message naturally and responds based on:
 * - Bot's personality (SOUL.md)
 * - Current context (what bot is doing)
 * - Conversation history
 * - Social awareness
 *
 * This example provides a simple fallback for testing without an LLM.
 */
function generateNaturalResponse(convo) {
  const { username, message, context } = convo;
  const msg = message.toLowerCase();

  // Simple fallback responses for testing (replace with LLM in production)
  if (msg.includes('what are you doing') || msg.includes('whatcha doing')) {
    const goal = context.botGoal || 'idle';
    return `I'm currently ${goal.replace(/_/g, ' ')}. Just doing my thing!`;
  }

  if (msg.includes('hello') || msg.includes('hi ') || msg.includes('hey')) {
    return `Hey ${username}! How's it going?`;
  }

  if (msg.includes('help')) {
    return `I appreciate the offer, ${username}, but I'm busy with my own projects right now.`;
  }

  if (msg.includes('where are you')) {
    if (context.position) {
      return `I'm at ${context.position.x}, ${context.position.y}, ${context.position.z}.`;
    }
    return "I'm not sure where I am right now!";
  }

  // Default: acknowledge the message
  return `Thanks for the message, ${username}. I'm focused on my goals right now.`;
}

console.log('Conversational agent started.');
console.log('Personality:', personality ? 'loaded' : 'default');
console.log('Watching:', CONVERSATIONS_FILE);
