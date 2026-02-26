const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Override config before loading events module
const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const TEST_EVENTS_FILE = path.join(TEST_DATA_DIR, 'events.json');

describe('events', () => {
  let events;

  before(() => {
    // Create test data directory
    if (!fs.existsSync(TEST_DATA_DIR)) fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    // Override config
    const config = require('../src/config');
    config.EVENTS_FILE = TEST_EVENTS_FILE;
    // Clear module cache and reload
    delete require.cache[require.resolve('../src/events')];
    events = require('../src/events');
  });

  beforeEach(() => {
    // Clean events file
    if (fs.existsSync(TEST_EVENTS_FILE)) fs.unlinkSync(TEST_EVENTS_FILE);
    // Reload to reset internal state
    delete require.cache[require.resolve('../src/events')];
    events = require('../src/events');
  });

  after(() => {
    // Cleanup
    if (fs.existsSync(TEST_EVENTS_FILE)) fs.unlinkSync(TEST_EVENTS_FILE);
    if (fs.existsSync(TEST_DATA_DIR)) fs.rmdirSync(TEST_DATA_DIR, { recursive: true });
  });

  describe('logEvent', () => {
    it('should create an event with incrementing id', () => {
      const e1 = events.logEvent('test', { data: 'hello' });
      const e2 = events.logEvent('test', { data: 'world' });
      assert.strictEqual(e1.id, 1);
      assert.strictEqual(e2.id, 2);
      assert.strictEqual(e1.type, 'test');
      assert.strictEqual(e1.data, 'hello');
    });

    it('should include a timestamp', () => {
      const before = Date.now();
      const e = events.logEvent('spawn', {});
      const after = Date.now();
      assert(e.timestamp >= before);
      assert(e.timestamp <= after);
    });

    it('should write events to disk', () => {
      events.logEvent('test', { msg: 'disk_check' });
      assert(fs.existsSync(TEST_EVENTS_FILE));
      const content = JSON.parse(fs.readFileSync(TEST_EVENTS_FILE, 'utf8'));
      assert(Array.isArray(content));
      assert.strictEqual(content.length, 1);
      assert.strictEqual(content[0].msg, 'disk_check');
    });

    it('should keep max 200 events', () => {
      for (let i = 0; i < 210; i++) {
        events.logEvent('flood', { i });
      }
      const content = JSON.parse(fs.readFileSync(TEST_EVENTS_FILE, 'utf8'));
      assert(content.length <= 200);
      // First events should have been shifted out
      assert(content[0].i >= 10);
    });
  });

  describe('safeWrite', () => {
    it('should write content to file', () => {
      const testFile = path.join(TEST_DATA_DIR, 'safe-write-test.json');
      events.safeWrite(testFile, '{"test": true}');
      const content = fs.readFileSync(testFile, 'utf8');
      assert.strictEqual(content, '{"test": true}');
      fs.unlinkSync(testFile);
    });
  });

  describe('loadEvents', () => {
    it('should load events from disk', () => {
      // Write events manually
      const testEvents = [
        { id: 5, timestamp: Date.now(), type: 'test', data: 'loaded' },
        { id: 10, timestamp: Date.now(), type: 'test2', data: 'loaded2' },
      ];
      fs.writeFileSync(TEST_EVENTS_FILE, JSON.stringify(testEvents));

      // Reload module
      delete require.cache[require.resolve('../src/events')];
      events = require('../src/events');
      events.loadEvents();

      // New events should continue from the highest id
      const e = events.logEvent('after_load', {});
      assert(e.id > 10);
    });

    it('should handle missing file gracefully', () => {
      if (fs.existsSync(TEST_EVENTS_FILE)) fs.unlinkSync(TEST_EVENTS_FILE);
      delete require.cache[require.resolve('../src/events')];
      events = require('../src/events');
      events.loadEvents();
      const e = events.logEvent('fresh_start', {});
      assert.strictEqual(e.id, 1);
    });

    it('should handle corrupted file gracefully', () => {
      fs.writeFileSync(TEST_EVENTS_FILE, 'NOT JSON!!!');
      delete require.cache[require.resolve('../src/events')];
      events = require('../src/events');
      events.loadEvents();
      const e = events.logEvent('after_corrupt', {});
      assert.strictEqual(e.id, 1);
    });
  });
});
