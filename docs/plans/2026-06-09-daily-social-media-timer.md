# Daily Social Media Timer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Manifest V3 Chrome extension showing shared daily social-media usage timer.

**Architecture:** Pure ES-module timer logic owns host matching, state normalization, reconciliation, midnight reset, and formatting. Background service worker serializes Chrome events into persisted timer state. Content script renders synchronized glass timer in Shadow DOM and ticks display locally.

**Tech Stack:** Chrome Manifest V3, JavaScript ES modules, Shadow DOM, Node built-in test runner

---

## Chunk 1: Core Timer

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `manifest.json`

- [ ] Add Node test scripts and extension manifest.
- [ ] Validate manifest JSON.
- [ ] Commit scaffold.

### Task 2: Pure Timer Logic

**Files:**
- Create: `src/timer.js`
- Test: `test/timer.test.js`

- [ ] Write failing tests for host matching and `HH:MM:SS` formatting.
- [ ] Run tests and confirm expected failures.
- [ ] Implement minimal matching and formatting.
- [ ] Write failing tests for state normalization, active/inactive reconciliation, inactivity cap, and midnight reset.
- [ ] Implement reconciliation.
- [ ] Run tests.
- [ ] Commit core timer.

## Chunk 2: Browser Integration

### Task 3: Background Service Worker

**Files:**
- Create: `src/background.js`
- Create: `src/background-controller.js`
- Test: `test/background-controller.test.js`

- [ ] Write failing tests for event reconciliation, persistence, and shared snapshot.
- [ ] Implement testable background controller.
- [ ] Wire Chrome tab/window/alarm/runtime events.
- [ ] Run tests.
- [ ] Commit background integration.

### Task 4: Content Timer UI

**Files:**
- Create: `src/content.js`
- Create: `src/content-view.js`
- Test: `test/content-view.test.js`

- [ ] Write failing tests for snapshot projection and local ticking.
- [ ] Implement pure display projection.
- [ ] Implement Shadow DOM glass timer and message synchronization.
- [ ] Run tests.
- [ ] Commit content UI.

## Chunk 3: Finish

### Task 5: Documentation and Verification

**Files:**
- Create: `README.md`

- [ ] Document install, behavior, permissions, supported sites.
- [ ] Run full test suite and manifest validation.
- [ ] Inspect extension files and Git diff.
- [ ] Commit docs.
