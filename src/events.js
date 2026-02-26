const fs = require('fs');
const path = require('path');
const { EVENTS_FILE } = require('./config');

let events = [];
let eventIdCounter = 0;

// Atomic write: write to temp file then rename
function safeWrite(file, content) {
  const tmp = file + '.tmp';
  try {
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error('Write failed:', file, err.message);
    // Fallback to direct write
    try { fs.writeFileSync(file, content); } catch (e) {}
  }
}

function logEvent(type, data) {
  const event = { id: ++eventIdCounter, timestamp: Date.now(), type, ...data };
  events.push(event);
  if (events.length > 200) events.shift();
  safeWrite(EVENTS_FILE, JSON.stringify(events, null, 2));
  return event;
}

function loadEvents() {
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
      if (events.length > 0) {
        eventIdCounter = Math.max(...events.map(e => e.id || 0));
      }
    }
  } catch (err) {
    events = [];
  }
}

module.exports = { logEvent, loadEvents, safeWrite };
