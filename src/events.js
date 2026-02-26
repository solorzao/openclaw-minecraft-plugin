const fs = require('fs');
const path = require('path');
const { EVENTS_FILE } = require('./config');

let events = [];
let eventIdCounter = 0;

function safeWrite(file, content) {
  // On Windows, atomic rename often fails due to file locks (VSCode, etc.)
  // Just write directly - the 1s interval makes partial reads unlikely
  try {
    fs.writeFileSync(file, content);
  } catch (err) {
    // Silently retry once after a brief delay
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

function getLatestEventId() {
  return eventIdCounter;
}

module.exports = { logEvent, loadEvents, safeWrite, getLatestEventId };
