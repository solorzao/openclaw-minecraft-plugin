const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('commands', () => {
  let commands;
  const TEST_DATA_DIR = path.join(__dirname, 'test-data');
  const TEST_COMMANDS_FILE = path.join(TEST_DATA_DIR, 'commands.json');

  before(() => {
    if (!fs.existsSync(TEST_DATA_DIR)) fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    const config = require('../src/config');
    config.COMMANDS_FILE = TEST_COMMANDS_FILE;
    config.EVENTS_FILE = path.join(TEST_DATA_DIR, 'events.json');
  });

  beforeEach(() => {
    if (fs.existsSync(TEST_COMMANDS_FILE)) fs.unlinkSync(TEST_COMMANDS_FILE);
    delete require.cache[require.resolve('../src/commands')];
    delete require.cache[require.resolve('../src/events')];
    commands = require('../src/commands');
  });

  after(() => {
    if (fs.existsSync(TEST_COMMANDS_FILE)) fs.unlinkSync(TEST_COMMANDS_FILE);
    const eventsFile = path.join(TEST_DATA_DIR, 'events.json');
    if (fs.existsSync(eventsFile)) fs.unlinkSync(eventsFile);
    try { fs.rmdirSync(TEST_DATA_DIR, { recursive: true }); } catch (e) {}
  });

  describe('pollCommands', () => {
    it('should handle missing commands file', () => {
      const mockBot = {};
      // Should not throw
      commands.pollCommands(mockBot);
    });

    it('should handle empty commands file', () => {
      fs.writeFileSync(TEST_COMMANDS_FILE, '[]');
      const mockBot = {};
      commands.pollCommands(mockBot);
      // File should still be '[]'
      const content = fs.readFileSync(TEST_COMMANDS_FILE, 'utf8');
      assert.strictEqual(content.trim(), '[]');
    });

    it('should handle malformed JSON gracefully', () => {
      fs.writeFileSync(TEST_COMMANDS_FILE, '{not valid json!!!');
      const mockBot = {};
      // Should not throw
      commands.pollCommands(mockBot);
    });

    it('should clear commands file after reading', () => {
      fs.writeFileSync(TEST_COMMANDS_FILE, JSON.stringify([
        { id: 'test-1', action: 'unknown_action_test' },
      ]));

      // Need a minimal bot to not crash on unknown action dispatch
      const mockBot = {};
      commands.pollCommands(mockBot);

      const content = fs.readFileSync(TEST_COMMANDS_FILE, 'utf8');
      assert.strictEqual(content, '[]');
    });
  });

  describe('executeCommand', () => {
    it('should log error for unknown action', async () => {
      const eventsFile = path.join(TEST_DATA_DIR, 'events.json');

      const mockBot = {};
      await commands.executeCommand(mockBot, { id: 'test', action: 'nonexistent' });

      // Check the events file for the logged error
      assert(fs.existsSync(eventsFile), 'Events file should exist');
      const eventsData = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
      const resultEvent = eventsData.find(e => e.type === 'command_result' && e.commandId === 'test');
      assert(resultEvent, 'Should have logged a command_result event');
      assert.strictEqual(resultEvent.success, false);
      assert(resultEvent.detail.includes('Unknown action'));
    });
  });
});
