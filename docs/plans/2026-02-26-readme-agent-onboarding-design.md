# README Agent Onboarding Redesign

**Date:** 2026-02-26
**Status:** Implemented

## Problem

Custom AI agents clone the repo, read the README, and can't figure out what to do. They reinvent the interface from scratch, write entire task specs manually, and the bot just stands still. An agent gave detailed feedback describing everything already documented — proving they never found the docs.

## Root Cause

The README was structured for human developers (install → architecture → config → commands). AI agents need to understand their role first: "you are the brain, the bot is a body, here's the interface."

## Design Decisions

1. **Agent-first README structure** — role explanation and interface contract come before setup instructions
2. **Raw JSON examples, not code** — agents read/write files directly, they don't build scripts
3. **Inline doc routing** — contextual links to deeper docs where relevant, not a link dump at the bottom
4. **"Don't duplicate" section** — explicit list of automatic behaviors so agents don't rebuild auto-eat/flee logic
5. **Decision priority skeleton** — structural decision pattern without baked-in personality, including combat response for staying alive
6. **Documentation index** — table mapping each doc to what's in it, so agents know where to go for what

## README Structure (New)

1. Title + one-line description
2. YOUR ROLE — the 3-file interface diagram, file descriptions
3. Controlling the Bot — command format, quick reference (10 most-used), command rules
4. Reading the World — key state fields, key event types
5. What the Bot Handles Automatically — don't-duplicate table
6. Decision Priority — health → combat → hunger → night → busy → inventory → tools → idle
7. Documentation Index — table with all docs and what they contain
8. Setup — install, config, start (moved to bottom)
9. File Structure

## Key Insight

The critical change: the agent's job description comes before installation instructions. An agent that already has the repo cloned needs to understand the interface, not how to `npm install`.
